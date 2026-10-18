import { forwardRef, useImperativeHandle, useState } from "react";
import { HTTP_METHODS } from "@/lib/http";
import { notify } from "@/lib/notify";
import { Icon } from "@/components/icons";
import CodeEditor from "./CodeEditor";
import {
  BodyFormat,
  SavedResponse,
  activeVariant,
  deleteResponse,
  loadResponses,
  normalisePath,
  pushResponse,
  sameEndpoint,
  saveResponses,
  specBody,
} from "./storage";

const FORMATS: { key: BodyFormat; label: string; language: string }[] = [
  { key: "json", label: "JSON", language: "json" },
  { key: "xml", label: "XML", language: "xml" },
  { key: "text", label: "Text", language: "plaintext" },
  { key: "html", label: "HTML", language: "html" },
  { key: "yaml", label: "YAML", language: "yaml" },
  { key: "form-urlencoded", label: "Form", language: "plaintext" },
  { key: "raw", label: "Raw", language: "plaintext" },
];
const SWITCH_WIDTH = 72;

const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#f4f4f4"><path d="M16 22 6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/></svg>',
)}")`;

const STATUS_PRESETS: [string, string][] = [
  ["200", "OK"],
  ["201", "Created"],
  ["202", "Accepted"],
  ["204", "No Content"],
  ["400", "Bad Request"],
  ["404", "Not Found"],
  ["500", "Server Error"],
];

const errorOf = (fn: () => void, fallback: string) => {
  try {
    fn();
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : fallback;
  }
};

const validateJSON = (v: string) => (v.trim() ? errorOf(() => JSON.parse(v), "Invalid JSON") : "");

function validateXML(v: string) {
  if (!v.trim()) return "";
  const doc = new DOMParser().parseFromString(v, "application/xml");
  return doc.querySelector("parsererror") ? "Invalid XML format" : "";
}

function validateForm(v: string) {
  if (!v.trim()) return "";
  return v.split("&").some((s) => s && !s.includes("="))
    ? "Each parameter must contain '=' (e.g. key=value&key2=value2)"
    : "";
}

function validateBody(format: BodyFormat, v: string) {
  if (format === "json") return validateJSON(v);
  if (format === "xml") return validateXML(v);
  if (format === "form-urlencoded") return validateForm(v);
  return "";
}

function formatJSON(v: string) {
  try {
    return JSON.stringify(JSON.parse(v), null, 2);
  } catch {
    return v;
  }
}

function formatXML(v: string) {
  if (validateXML(v)) return v;
  let indent = 0;
  return v
    .replace(/>\s*</g, "><")
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t.startsWith("</")) indent = Math.max(0, indent - 1);
      const out = "  ".repeat(indent) + t;
      if (t.startsWith("<") && !t.startsWith("</") && !t.endsWith("/>") && !t.includes("<?xml") && !t.includes("</")) indent++;
      return out;
    })
    .join("\n");
}

function bodyTemplate(format: BodyFormat) {
  const now = new Date().toISOString();
  switch (format) {
    case "json":
      return JSON.stringify({ status: "success", message: "Request processed successfully", data: { id: 1, name: "Example Response", created_at: now } }, null, 2);
    case "xml":
      return `<?xml version="1.0" encoding="UTF-8"?>\n<response>\n  <status>success</status>\n  <message>Request processed successfully</message>\n  <data>\n    <id>1</id>\n    <name>Example Response</name>\n    <created_at>${now}</created_at>\n  </data>\n</response>`;
    case "text":
      return "Request processed successfully.";
    case "html":
      return `<!DOCTYPE html>\n<html>\n<head>\n  <title>Response</title>\n</head>\n<body>\n  <h1>Success</h1>\n  <p>Request processed successfully.</p>\n</body>\n</html>`;
    case "yaml":
      return `status: success\nmessage: Request processed successfully\ndata:\n  id: 1\n  name: Example Response\n  created_at: "${now}"`;
    case "form-urlencoded":
      return "status=success&message=Request+processed+successfully";
    default:
      return "";
  }
}

function initialState(saved: SavedResponse | undefined) {
  if (!saved) return { statusCode: "200", headers: "", body: "", bodyFormat: "json" as BodyFormat };
  const format = saved.bodyFormat || "json";
  const body =
    saved.body === undefined || saved.body === null
      ? ""
      : typeof saved.body === "string"
        ? saved.body
        : JSON.stringify(saved.body, null, 2);
  return {
    statusCode: String(saved.statusCode ?? ""),
    headers: saved.headers && Object.keys(saved.headers).length ? JSON.stringify(saved.headers, null, 2) : "",
    body,
    bodyFormat: format,
  };
}

const stable = (v: unknown) => JSON.stringify(v ?? "");

/** Whether an imported response was edited away from what the specification says. */
function differsFromSpec(r: SavedResponse) {
  const variant = activeVariant(r);
  if (!variant) return true;
  return (
    stable(r.body) !== stable(specBody(r)) ||
    stable(r.headers) !== stable(variant.headers) ||
    r.bodyFormat !== variant.bodyFormat
  );
}

export type EditorTarget = { method: string; endpoint: string; isNew: boolean };

export interface ResponseEditorHandle {
  save: () => void;
}

const ResponseEditor = forwardRef<
  ResponseEditorHandle,
  {
    target: EditorTarget;
    webhookId: string;
    saved?: SavedResponse;
    onSaved: (response: SavedResponse) => void;
    onRemoved: () => void;
    onBusyChange: (busy: boolean) => void;
  }
>(function ResponseEditor({ target, webhookId, saved, onSaved, onRemoved, onBusyChange }, ref) {
  const init = initialState(saved);
  const [method, setMethod] = useState(target.method);
  const [endpoint, setEndpoint] = useState(target.endpoint);
  const [statusCode, setStatusCode] = useState(init.statusCode);
  const [headers, setHeaders] = useState(init.headers);
  const [body, setBody] = useState(init.body);
  const [bodyFormat, setBodyFormat] = useState<BodyFormat>(init.bodyFormat);
  const [headersError, setHeadersError] = useState(validateJSON(init.headers));
  const [bodyError, setBodyError] = useState(validateBody(init.bodyFormat, init.body));
  const [error, setError] = useState("");

  const isSpec = saved?.source === "openapi";
  const format = FORMATS.find((f) => f.key === bodyFormat) ?? FORMATS[0];
  const formatIndex = FORMATS.indexOf(format);

  const changeFormat = (next: BodyFormat) => {
    setBodyFormat(next);
    setBodyError(validateBody(next, body));
  };

  const save = async () => {
    setError("");
    const path = normalisePath(endpoint.trim());
    if (headersError || bodyError) return setError("Fix the validation errors before saving.");
    if (!statusCode) return setError("Set a status code.");
    const code = Number(statusCode);
    if (!Number.isInteger(code) || code < 100 || code > 599) return setError("Status code must be between 100 and 599.");
    if (body === "" && bodyFormat !== "raw" && code !== 204) return setError("Add a response body, or use Raw.");

    let parsedHeaders: Record<string, string>;
    let parsedBody: unknown;
    try {
      parsedHeaders = headers.trim() ? JSON.parse(headers) : {};
      parsedBody = bodyFormat === "json" && body.trim() ? JSON.parse(body) : body;
    } catch {
      return setError("Invalid format in headers or body.");
    }

    onBusyChange(true);
    try {
      const response: SavedResponse = {
        ...(isSpec ? saved : {}),
        method,
        endpoint: path,
        statusCode,
        headers: parsedHeaders,
        body: parsedBody,
        bodyFormat,
      };
      if (isSpec && saved) response.overridden = differsFromSpec(response);
      await pushResponse(webhookId, response);
      saveResponses(webhookId, [...loadResponses(webhookId).filter((r) => !sameEndpoint(r, response)), response]);
      notify({ kind: "success", title: "Response saved", subtitle: `${method} ${path} → ${statusCode}`, mono: true });
      onSaved(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error or invalid server response.");
    } finally {
      onBusyChange(false);
    }
  };

  useImperativeHandle(ref, () => ({ save }));

  const remove = async () => {
    try {
      await deleteResponse(webhookId, target);
    } catch {
      /* the local copy is removed regardless */
    }
    saveResponses(webhookId, loadResponses(webhookId).filter((r) => !sameEndpoint(r, target)));
    notify({ title: "Custom response removed", subtitle: `${target.method} ${target.endpoint}`, mono: true });
    onRemoved();
  };

  return (
    <div className={isSpec ? "flex flex-col gap-6" : "enter-up flex flex-col gap-6 pb-8 pl-6 pr-4 pt-6"}>
      {!isSpec && (
      <>
      <div className="grid grid-cols-[128px_minmax(0,1fr)_160px] gap-4">
        <label className="flex flex-col gap-2">
          <span className="label-01">Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={!target.isNew}
            className="field appearance-none bg-no-repeat pr-10 disabled:cursor-default"
            style={{ backgroundImage: CHEVRON, backgroundSize: 16, backgroundPosition: "right 12px center" }}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-01">Endpoint</span>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            readOnly={!target.isNew}
            placeholder="/api/v3/user"
            className="field font-mono read-only:text-text-secondary"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-01">Status code</span>
          <input
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder="200"
            className="field font-mono"
          />
        </label>
      </div>

      <div role="group" aria-label="Common status codes" className="-mt-2 flex flex-wrap gap-2">
        {STATUS_PRESETS.map(([code, label]) => {
          const active = code === statusCode;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusCode(code)}
              className="h-6 rounded-full px-[10px] text-label transition-colors duration-70"
              style={{ background: active ? "#f4f4f4" : "#393939", color: active ? "#161616" : "#f4f4f4" }}
            >
              {code} {label}
            </button>
          );
        })}
      </div>
      </>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label-01">Response headers (JSON)</span>
          <button
            type="button"
            onClick={() => {
              setHeaders(JSON.stringify({ Authorization: "Bearer your-token-here", "X-API-Key": "your-api-key" }, null, 2));
              setHeadersError("");
            }}
            className="btn btn-ghost h-8 px-3 text-link"
          >
            Insert template
          </button>
        </div>
        <CodeEditor
          label="Response headers"
          language="json"
          height={120}
          lineNumbers={false}
          value={headers}
          invalid={!!headersError}
          onChange={(v) => {
            setHeaders(v);
            setHeadersError(validateJSON(v));
          }}
          onBlur={() => setHeaders((h) => (h && !validateJSON(h) ? formatJSON(h) : h))}
        />
        {headersError && <span className="text-label text-support-error">{headersError}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-01">Response body</span>
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="Body format" className="relative flex border border-solid border-border-strong">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 h-8 bg-inverse transition-transform duration-240 ease-productive"
                style={{ width: SWITCH_WIDTH, transform: `translateX(${formatIndex * SWITCH_WIDTH}px)` }}
              />
              {FORMATS.map((f) => {
                const active = f.key === bodyFormat;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeFormat(f.key)}
                    className="relative h-8 bg-transparent text-compact transition-colors duration-110 hover:text-text-primary"
                    style={{ width: SWITCH_WIDTH, color: active ? "#161616" : "#c6c6c6" }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setBody(bodyTemplate(bodyFormat));
                setBodyError("");
              }}
              className="btn btn-ghost h-8 px-3 text-link"
            >
              Insert template
            </button>
          </div>
        </div>
        <CodeEditor
          label="Response body"
          language={format.language}
          height={200}
          value={body}
          invalid={!!bodyError}
          onChange={(v) => {
            setBody(v);
            setBodyError(validateBody(bodyFormat, v));
          }}
          onBlur={() =>
            setBody((b) => {
              if (!b || validateBody(bodyFormat, b)) return b;
              if (bodyFormat === "json") return formatJSON(b);
              if (bodyFormat === "xml") return formatXML(b);
              return b;
            })
          }
        />
        {bodyFormat === "raw" && <span className="text-label text-support-warning">Set Content-Type in the headers.</span>}
        {bodyError && <span className="text-label text-support-error">{bodyError}</span>}
        <span className="text-label text-text-helper">Ctrl+Shift+F formats the editor.</span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 bg-layer-2 py-3 pl-[13px] pr-4" style={{ borderLeft: "3px solid #fa4d56" }}>
          <span className="text-compact">{error}</span>
        </div>
      )}

      {saved && (
        <button
          type="button"
          onClick={remove}
          className="btn h-10 gap-8 self-start bg-transparent px-4 text-[#ff8389] hover:bg-btn-danger hover:text-white"
        >
          Remove custom response
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
});

export default ResponseEditor;
