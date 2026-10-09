import yaml from "js-yaml";
import { BufferBody, WebhookMessage } from "@/types/webhook";
import { headerValue } from "@/lib/http";

export type Segment = { text: string; color: string; italic?: boolean };
export type CodeLine = Segment[];

export const SYNTAX = {
  key: "#78a9ff",
  string: "#6fdc8c",
  number: "#ffb784",
  keyword: "#be95ff",
  punctuation: "#8d8d8d",
  text: "#f4f4f4",
  comment: "#8d8d8d",
};

const plain = (text: string): CodeLine => [{ text: text || " ", color: SYNTAX.text }];

export function tokenizeJsonLine(line: string): CodeLine {
  const re =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;
  const out: CodeLine = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), color: SYNTAX.text });
    if (m[1]) {
      if (m[2]) {
        out.push({ text: m[1], color: SYNTAX.key });
        out.push({ text: m[2], color: SYNTAX.punctuation });
      } else out.push({ text: m[1], color: SYNTAX.string });
    } else if (m[3]) out.push({ text: m[3], color: SYNTAX.keyword });
    else if (m[4]) out.push({ text: m[4], color: SYNTAX.number });
    else out.push({ text: m[5], color: SYNTAX.punctuation });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ text: line.slice(last), color: SYNTAX.text });
  return out.length ? out : plain("");
}

export function tokenizeXmlLine(line: string): CodeLine {
  const re = /(<\/?[\w:?!-]+)|(\s[\w:-]+=)("[^"]*")|(\??\/?>)/g;
  const out: CodeLine = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), color: SYNTAX.text });
    if (m[1]) out.push({ text: m[1], color: SYNTAX.key });
    else if (m[2]) {
      out.push({ text: m[2], color: SYNTAX.keyword });
      out.push({ text: m[3], color: SYNTAX.string });
    } else out.push({ text: m[4], color: SYNTAX.key });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ text: line.slice(last), color: SYNTAX.text });
  return out.length ? out : plain("");
}

export const jsonLines = (value: unknown): CodeLine[] =>
  JSON.stringify(value, null, 2).split("\n").map(tokenizeJsonLine);

function formatXML(xmlString: string): string {
  try {
    const xmlDoc = new DOMParser().parseFromString(xmlString, "application/xml");
    if (xmlDoc.querySelector("parsererror")) return xmlString;

    const serialize = (node: Node, depth: number): string => {
      const pad = "  ".repeat(depth);
      if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
        const pi = node as ProcessingInstruction;
        return `${pad}<?${pi.target} ${pi.data}?>`;
      }
      if (node.nodeType === Node.COMMENT_NODE) return `${pad}<!--${node.textContent}-->`;
      if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() || "";
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const attrs = Array.from(el.attributes)
          .map((a) => ` ${a.name}="${a.value}"`)
          .join("");
        const children = Array.from(el.childNodes)
          .map((child) => serialize(child, depth + 1))
          .filter(Boolean);
        if (children.length === 0) return `${pad}<${el.tagName}${attrs} />`;
        if (children.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
          return `${pad}<${el.tagName}${attrs}>${el.childNodes[0].textContent?.trim()}</${el.tagName}>`;
        }
        return `${pad}<${el.tagName}${attrs}>\n${children.join("\n")}\n${pad}</${el.tagName}>`;
      }
      if (node.nodeType === Node.DOCUMENT_NODE) {
        return Array.from(node.childNodes)
          .map((child) => serialize(child, depth))
          .filter(Boolean)
          .join("\n");
      }
      return "";
    };

    const decl = xmlString.match(/^<\?xml[^?]*\?>/);
    const body = serialize(xmlDoc, 0);
    return decl ? `${decl[0]}\n${body}` : body;
  } catch {
    return xmlString;
  }
}

function formatYAML(value: string): string {
  try {
    return yaml.dump(yaml.load(value), { indent: 2, lineWidth: -1 });
  } catch {
    return value;
  }
}

export const isBufferBody = (body: unknown): body is BufferBody =>
  !!body &&
  typeof body === "object" &&
  (body as BufferBody).type === "Buffer" &&
  Array.isArray((body as BufferBody).data);

const isEmptyBody = (body: unknown) =>
  body === undefined ||
  body === null ||
  (typeof body === "string" && body.length === 0) ||
  (typeof body === "object" && !isBufferBody(body) && Object.keys(body as object).length === 0);

const TEXTUAL = /json|xml|text|yaml|html|javascript|x-www-form-urlencoded|csv/;

export type BodyView =
  | { kind: "none" }
  | { kind: "binary"; bytes: number[]; size: number; truncated: boolean; contentType: string }
  | {
      kind: "text";
      lines: CodeLine[];
      /** One wrapped line (raw view) instead of a numbered, unwrapped listing. */
      wrap: boolean;
      /** Text the Copy button puts on the clipboard for the current view. */
      copyText: string;
      bytes: number;
      prettyAvailable: boolean;
      invalidJson?: string;
    };

export function describeBody(message: WebhookMessage, pretty: boolean): BodyView {
  const body = message.body;
  const contentType = (headerValue(message.headers, "Content-Type") ?? "").toLowerCase();

  if (isBufferBody(body)) {
    // Raw parser output: text formats (e.g. XML sent as octet-stream) are still readable.
    if (contentType && TEXTUAL.test(contentType)) {
      return describeText(new TextDecoder().decode(new Uint8Array(body.data)), contentType, pretty);
    }
    return {
      kind: "binary",
      bytes: body.data,
      size: body.size ?? body.data.length,
      truncated: !!body.truncated,
      contentType: contentType || "application/octet-stream",
    };
  }

  if (isEmptyBody(body)) return { kind: "none" };

  if (typeof body === "string") return describeText(body, contentType, pretty);

  const raw = JSON.stringify(body);
  return {
    kind: "text",
    lines: pretty ? jsonLines(body) : [plain(raw)],
    wrap: !pretty,
    copyText: pretty ? JSON.stringify(body, null, 2) : raw,
    bytes: new TextEncoder().encode(raw).length,
    prettyAvailable: true,
  };
}

function describeText(text: string, contentType: string, pretty: boolean): BodyView {
  const bytes = new TextEncoder().encode(text).length;
  const base = { kind: "text" as const, bytes, prettyAvailable: true };

  let parsed: unknown;
  let jsonError: string | undefined;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    jsonError = e instanceof Error ? e.message : String(e);
  }

  if (contentType.includes("json") && jsonError) {
    return { ...base, lines: [plain(text)], wrap: true, copyText: text, prettyAvailable: false, invalidJson: jsonError };
  }

  if (!pretty) return { ...base, lines: [plain(text)], wrap: true, copyText: text };

  if (parsed !== undefined && typeof parsed === "object" && parsed !== null) {
    return { ...base, lines: jsonLines(parsed), wrap: false, copyText: JSON.stringify(parsed, null, 2) };
  }
  if (contentType.includes("xml")) {
    const formatted = formatXML(text);
    return { ...base, lines: formatted.split("\n").map(tokenizeXmlLine), wrap: false, copyText: formatted };
  }
  if (contentType.includes("x-www-form-urlencoded")) {
    const pairs = Array.from(new URLSearchParams(text).entries());
    return {
      ...base,
      lines: pairs.map(([k, v]) => [
        { text: k, color: SYNTAX.key },
        { text: " = ", color: SYNTAX.punctuation },
        { text: v, color: SYNTAX.string },
      ]),
      wrap: false,
      copyText: pairs.map(([k, v]) => `${k} = ${v}`).join("\n"),
    };
  }
  if (contentType.includes("yaml")) {
    const formatted = formatYAML(text);
    return { ...base, lines: formatted.split("\n").map((l) => plain(l)), wrap: false, copyText: formatted };
  }
  return { ...base, lines: text.split("\n").map((l) => plain(l)), wrap: false, copyText: text };
}

export type HexRow = { offset: string; hex: string; ascii: string };

export function hexDump(bytes: number[], limit = 128): HexRow[] {
  const rows: HexRow[] = [];
  const slice = bytes.slice(0, limit);
  for (let i = 0; i < slice.length; i += 16) {
    const chunk = slice.slice(i, i + 16);
    rows.push({
      offset: i.toString(16).padStart(8, "0"),
      hex: chunk.map((b, j) => b.toString(16).padStart(2, "0") + (j === 7 ? "  " : " ")).join(""),
      ascii: chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join(""),
    });
  }
  return rows;
}

export function bytesToBase64(bytes: number[]) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return btoa(binary);
}
