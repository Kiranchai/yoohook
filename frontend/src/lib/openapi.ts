import yaml from "js-yaml";
import type { BodyFormat } from "@/components/responses/storage";

/** How the body of one response variant was obtained. */
export type VariantSource = "example" | "examples" | "generated" | "empty";

export interface SpecVariant {
  statusCode: string;
  source: VariantSource;
  /** Body for `example` / `generated`; undefined when `empty`. */
  body?: unknown;
  /** Named examples (OpenAPI 3 `examples`), when the spec lists several. */
  examples?: Record<string, unknown>;
  headers: Record<string, string>;
  bodyFormat: BodyFormat;
}

export interface SpecOperation {
  /** operationId, or METHOD + path when the spec has none. */
  id: string;
  method: string;
  /** Path template as written in the spec, without the base path. */
  path: string;
  tag: string;
  summary: string;
  responses: SpecVariant[];
}

export interface ParsedSpec {
  title: string;
  version: string;
  /** e.g. "OpenAPI 3.0.3" or "Swagger 2.0". */
  format: string;
  /** Path part of servers[0] (OpenAPI 3) or basePath (Swagger 2), e.g. "/v2". */
  basePath: string;
  tags: string[];
  operations: SpecOperation[];
}

type Obj = Record<string, unknown>;

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const MAX_DEPTH = 8;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Parses JSON or YAML text into an OpenAPI 3 / Swagger 2 document. */
export function parseSpec(text: string): ParsedSpec {
  let doc: unknown;
  try {
    doc = text.trim().startsWith("{") ? JSON.parse(text) : yaml.load(text);
  } catch (e) {
    throw new Error(`The file isn't valid JSON or YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isObj(doc)) throw new Error("The file doesn't contain an OpenAPI document.");

  const openapi = typeof doc.openapi === "string" ? doc.openapi : null;
  const swagger = typeof doc.swagger === "string" ? doc.swagger : null;
  if (!openapi && !swagger) throw new Error("Missing the `openapi` or `swagger` field: this doesn't look like an OpenAPI file.");
  if (!isObj(doc.paths)) throw new Error("The specification has no `paths`.");

  const root = doc;
  const deref = (node: unknown, seen = new Set<string>()): unknown => {
    let current = node;
    while (isObj(current) && typeof current.$ref === "string") {
      const ref = current.$ref;
      if (!ref.startsWith("#/")) throw new Error(`External reference ${ref} isn't supported. Bundle the specification into one file first.`);
      if (seen.has(ref)) return {};
      seen.add(ref);
      current = ref
        .slice(2)
        .split("/")
        .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
        .reduce<unknown>((acc, key) => (isObj(acc) || Array.isArray(acc) ? (acc as Obj)[key] : undefined), root);
      if (current === undefined) throw new Error(`Reference ${ref} points to nothing.`);
    }
    return current;
  };

  const sample = (schemaNode: unknown, depth = 0, refs: string[] = []): unknown => {
    if (depth > MAX_DEPTH || !isObj(schemaNode)) return null;
    const ref = typeof schemaNode.$ref === "string" ? schemaNode.$ref : null;
    if (ref && refs.includes(ref)) return null; // recursive schema
    const schema = deref(schemaNode) as Obj;
    const nextRefs = ref ? [...refs, ref] : refs;
    if (!isObj(schema)) return null;

    if (schema.example !== undefined) return schema.example;
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (schema.default !== undefined) return schema.default;
    if (schema.const !== undefined) return schema.const;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

    if (Array.isArray(schema.allOf)) {
      return schema.allOf.reduce<unknown>((acc, part) => {
        const value = sample(part, depth + 1, nextRefs);
        return isObj(acc) && isObj(value) ? { ...acc, ...value } : value ?? acc;
      }, {});
    }
    const variants = (schema.oneOf ?? schema.anyOf) as unknown[] | undefined;
    if (Array.isArray(variants) && variants.length) return sample(variants[0], depth + 1, nextRefs);

    let type = schema.type;
    if (Array.isArray(type)) type = type.find((t) => t !== "null") ?? "null";
    if (!type) type = isObj(schema.properties) ? "object" : schema.items ? "array" : "string";

    switch (type) {
      case "object": {
        const out: Obj = {};
        for (const [name, prop] of Object.entries((schema.properties as Obj) ?? {})) {
          const p = deref(prop) as Obj;
          if (isObj(p) && p.writeOnly) continue;
          out[name] = sample(prop, depth + 1, nextRefs);
        }
        return out;
      }
      case "array":
        return schema.items ? [sample(schema.items, depth + 1, nextRefs)] : [];
      case "integer":
      case "number":
        return typeof schema.minimum === "number" ? schema.minimum : 0;
      case "boolean":
        return true;
      case "null":
        return null;
      default:
        return sampleString(schema.format as string | undefined);
    }
  };

  const variantsOf = (op: Obj): SpecVariant[] => {
    const responses = isObj(op.responses) ? op.responses : {};
    const out: SpecVariant[] = [];
    for (const [code, raw] of Object.entries(responses)) {
      const statusCode = /^\d{3}$/.test(code) ? code : /^[1-5]XX$/i.test(code) ? `${code[0]}00` : null;
      if (!statusCode) continue; // `default` and other non-numeric keys
      const response = deref(raw) as Obj;
      if (!isObj(response)) continue;
      out.push(swagger ? swaggerVariant(statusCode, response) : openApiVariant(statusCode, response));
    }
    return out.sort((a, b) => Number(a.statusCode) - Number(b.statusCode));
  };

  const headersOf = (raw: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [name, h] of Object.entries(isObj(raw) ? raw : {})) {
      const header = deref(h) as Obj;
      if (!isObj(header)) continue;
      const value = header.example ?? (header.schema ? sample(header.schema) : sample(header));
      if (value !== null && value !== undefined) out[name] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return out;
  };

  const openApiVariant = (statusCode: string, response: Obj): SpecVariant => {
    const headers = headersOf(response.headers);
    const content = isObj(response.content) ? response.content : {};
    const types = Object.keys(content);
    const contentType =
      types.find((t) => t === "application/json") ?? types.find((t) => /[/+]json/.test(t)) ?? types[0];
    if (!contentType) return { statusCode, source: "empty", headers, bodyFormat: "raw" };

    const media = deref(content[contentType]) as Obj;
    const bodyFormat = formatOf(contentType);
    if (!/^application\/json$/.test(contentType)) headers["Content-Type"] = contentType;

    if (isObj(media) && media.example !== undefined) return { statusCode, source: "example", body: media.example, headers, bodyFormat };
    if (isObj(media) && isObj(media.examples) && Object.keys(media.examples).length) {
      const examples: Record<string, unknown> = {};
      for (const [name, ex] of Object.entries(media.examples)) {
        const e = deref(ex) as Obj;
        if (isObj(e) && e.value !== undefined) examples[name] = e.value;
      }
      const names = Object.keys(examples);
      if (names.length === 1) return { statusCode, source: "example", body: examples[names[0]], headers, bodyFormat };
      if (names.length > 1) return { statusCode, source: "examples", body: examples[names[0]], examples, headers, bodyFormat };
    }
    if (isObj(media) && media.schema && bodyFormat === "json") {
      return { statusCode, source: "generated", body: sample(media.schema), headers, bodyFormat };
    }
    return { statusCode, source: "empty", headers, bodyFormat: "raw" };
  };

  const swaggerVariant = (statusCode: string, response: Obj): SpecVariant => {
    const headers = headersOf(response.headers);
    const examples = isObj(response.examples) ? response.examples : {};
    const exampleType = Object.keys(examples).find((t) => /json/.test(t)) ?? Object.keys(examples)[0];
    if (exampleType) {
      const bodyFormat = formatOf(exampleType);
      if (!/^application\/json$/.test(exampleType)) headers["Content-Type"] = exampleType;
      return { statusCode, source: "example", body: examples[exampleType], headers, bodyFormat };
    }
    if (response.schema) return { statusCode, source: "generated", body: sample(response.schema), headers, bodyFormat: "json" };
    return { statusCode, source: "empty", headers, bodyFormat: "raw" };
  };

  const operations: SpecOperation[] = [];
  for (const [path, rawItem] of Object.entries(doc.paths as Obj)) {
    const item = deref(rawItem) as Obj;
    if (!isObj(item)) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      const responses = variantsOf(op);
      if (!responses.length) continue;
      operations.push({
        id: typeof op.operationId === "string" ? op.operationId : `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path: "/" + path.replace(/^\/+/, ""),
        tag: Array.isArray(op.tags) && typeof op.tags[0] === "string" ? op.tags[0] : "Other",
        summary: typeof op.summary === "string" ? op.summary : "",
        responses,
      });
    }
  }
  if (!operations.length) throw new Error("The specification has no operations with responses.");

  const info = isObj(doc.info) ? doc.info : {};
  const declaredTags = Array.isArray(doc.tags) ? doc.tags.map((t) => (isObj(t) ? String(t.name) : "")).filter(Boolean) : [];
  const usedTags = Array.from(new Set(operations.map((o) => o.tag)));
  const tags = [...declaredTags.filter((t) => usedTags.includes(t)), ...usedTags.filter((t) => !declaredTags.includes(t))];

  return {
    title: typeof info.title === "string" ? info.title : "Untitled API",
    version: typeof info.version === "string" ? info.version : "",
    format: openapi ? `OpenAPI ${openapi}` : `Swagger ${swagger}`,
    basePath: openapi ? serverBasePath(doc.servers) : cleanBase(typeof doc.basePath === "string" ? doc.basePath : ""),
    tags,
    operations,
  };
}

function sampleString(format?: string) {
  switch (format) {
    case "date-time":
      return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "uuid":
      return crypto.randomUUID();
    case "email":
      return "user@example.com";
    case "uri":
    case "url":
      return "https://example.com";
    case "ipv4":
      return "203.0.113.10";
    case "byte":
      return "U3dhZ2dlciByb2Nrcw==";
    default:
      return "string";
  }
}

function formatOf(contentType: string): BodyFormat {
  if (/json/.test(contentType)) return "json";
  if (/xml/.test(contentType)) return "xml";
  if (/yaml/.test(contentType)) return "yaml";
  if (/html/.test(contentType)) return "html";
  if (/x-www-form-urlencoded/.test(contentType)) return "form-urlencoded";
  if (/^text\//.test(contentType)) return "text";
  return "raw";
}

const cleanBase = (path: string) => {
  const p = "/" + path.split("/").filter(Boolean).join("/");
  return p === "/" ? "" : p;
};

function serverBasePath(servers: unknown): string {
  if (!Array.isArray(servers) || !isObj(servers[0]) || typeof servers[0].url !== "string") return "";
  const server = servers[0];
  // Fill server variables ({version}) with their defaults.
  const url = (server.url as string).replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = isObj(server.variables) ? (server.variables as Obj)[name] : undefined;
    return isObj(v) && v.default !== undefined ? String(v.default) : name;
  });
  try {
    return cleanBase(new URL(url, "http://placeholder").pathname);
  } catch {
    return "";
  }
}

/** First 2xx variant, else the first one. */
export const defaultVariant = (op: SpecOperation) =>
  op.responses.find((r) => r.statusCode.startsWith("2")) ?? op.responses[0];

/** Splits a path template into literal and `{param}` parts for highlighting. */
export const pathParts = (path: string) =>
  path
    .split(/(\{[^/{}]+\})/)
    .filter(Boolean)
    .map((text) => ({ text, param: text.startsWith("{") }));

export const pathParams = (path: string) => (path.match(/\{[^/{}]+\}/g) ?? []).map((p) => p.slice(1, -1));

/** Whether a concrete request path matches a template like /orders/{id}. */
export function matchesTemplate(template: string, path: string) {
  const t = template.split("/").filter(Boolean);
  const p = path.split("/").filter(Boolean);
  return t.length === p.length && t.every((s, i) => /^\{[^/{}]+\}$/.test(s) || s === p[i]);
}

export const SOURCES: Record<VariantSource, { label: string; color: string; title: string; text: string }> = {
  example: {
    label: "example",
    color: "#42be65",
    title: "From the vendor’s example",
    text: "Copied as-is from the response example in the specification.",
  },
  examples: {
    label: "named examples",
    color: "#42be65",
    title: "From a named example",
    text: "The specification lists several examples. Pick the one yoohook should return; you can change it later.",
  },
  generated: {
    label: "generated",
    color: "#be95ff",
    title: "Generated from the schema",
    text: "No example in the specification, so yoohook built one from the schema: enums use their first value, formats get realistic values, arrays get one item.",
  },
  empty: {
    label: "no body",
    color: "#a8a8a8",
    title: "No body",
    text: "The specification defines this response without content.",
  },
};

export const paramText = (path: string) => {
  const params = pathParams(path);
  return params.length
    ? `{${params.join("}, {")}} matches any single path segment, e.g. ${path.replace(/\{[^/{}]+\}/g, "abc123")}.`
    : "None. The path is matched exactly.";
};
