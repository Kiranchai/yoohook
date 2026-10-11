import { WebhookMessage } from "@/types/webhook";
import { headerValue, hookUrl, queryString, requestPath } from "@/lib/http";
import { isBufferBody } from "@/lib/body";

export type CurlPart = { text: string; kind: "command" | "flag" | "value" | "break" };

// Headers curl sets itself or that would break a replay.
const SKIPPED = new Set(["content-length", "host", "connection", "accept-encoding"]);

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** A shell-ready cURL command that replays the request against the same hook. */
export function buildCurl(message: WebhookMessage, webhookId: string) {
  const lines: CurlPart[][] = [
    [
      { text: "curl", kind: "command" },
      { text: ` -X ${message.method} `, kind: "flag" },
      { text: quote(hookUrl(webhookId) + requestPath(message) + queryString(message.queryParams)), kind: "value" },
    ],
  ];

  const multipart = (headerValue(message.headers, "Content-Type") ?? "").toLowerCase().includes("multipart/form-data");

  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (SKIPPED.has(name.toLowerCase())) continue;
    // curl generates its own multipart boundary
    if (multipart && name.toLowerCase() === "content-type") continue;
    if (name === "base64username" || name === "base64password") continue;
    lines.push([
      { text: "  -H ", kind: "flag" },
      { text: quote(`${name}: ${value}`), kind: "value" },
    ]);
  }

  const body = message.body;
  if (multipart) {
    for (const [field, value] of Object.entries(message.formData ?? {})) {
      const file = value as { originalname?: string } | null;
      const arg = file && typeof file === "object" && file.originalname ? `${field}=@${file.originalname}` : `${field}=${String(value)}`;
      lines.push([
        { text: "  -F ", kind: "flag" },
        { text: quote(arg), kind: "value" },
      ]);
    }
  } else if (isBufferBody(body)) {
    lines.push([
      { text: "  --data-binary ", kind: "flag" },
      { text: "@body.bin", kind: "value" },
    ]);
  } else if (typeof body === "string" ? body.length > 0 : body && Object.keys(body as object).length > 0) {
    lines.push([
      { text: "  --data-raw ", kind: "flag" },
      { text: quote(typeof body === "string" ? body : JSON.stringify(body)), kind: "value" },
    ]);
  }

  const parts: CurlPart[] = [];
  lines.forEach((line, i) => {
    parts.push(...line);
    if (i < lines.length - 1) parts.push({ text: " \\\n", kind: "break" });
  });

  return { parts, text: parts.map((p) => p.text).join(""), lineCount: lines.length };
}
