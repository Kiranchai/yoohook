import { WebhookMessage } from "@/types/webhook";

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? "";
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? "";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

type Swatch = { bg: string; fg: string };

/** Square chips in the request list: dark 80-grade fill, light 30–40 text. */
const METHOD_CHIP: Record<string, Swatch> = {
  GET: { bg: "#002d9c", fg: "#a6c8ff" },
  POST: { bg: "#044317", fg: "#6fdc8c" },
  PUT: { bg: "#004144", fg: "#3ddbd9" },
  PATCH: { bg: "#491d8b", fg: "#be95ff" },
  DELETE: { bg: "#750e13", fg: "#ff8389" },
  HEAD: { bg: "#003a6d", fg: "#82cfff" },
  OPTIONS: { bg: "#393939", fg: "#c6c6c6" },
};

/** Rounded Carbon tags used everywhere else. */
const METHOD_TAG: Record<string, Swatch> = {
  GET: { bg: "#0043ce", fg: "#d0e2ff" },
  POST: { bg: "#0e6027", fg: "#a7f0ba" },
  PUT: { bg: "#005d5d", fg: "#9ef0f0" },
  PATCH: { bg: "#6929c4", fg: "#e8daff" },
  DELETE: { bg: "#a2191f", fg: "#ffd7d9" },
  HEAD: { bg: "#00539a", fg: "#bae6ff" },
  OPTIONS: { bg: "#525252", fg: "#e0e0e0" },
};

export const methodChip = (method: string): Swatch =>
  METHOD_CHIP[method] ?? METHOD_CHIP.OPTIONS;

export const methodTag = (method: string): Swatch =>
  METHOD_TAG[method] ?? METHOD_TAG.OPTIONS;

export const statusColor = (status: number): string =>
  status >= 500 ? "#fa4d56" : status >= 400 ? "#f1c21b" : status >= 300 ? "#78a9ff" : "#42be65";

const REASONS: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export const reasonPhrase = (status: number): string => REASONS[status] ?? "";

/** Headers added by the proxy / edge in front of the backend, not by the sender. */
export const SERVER_HEADERS = [
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Forwarded-Proto",
  "X-Forwarded-Port",
  "X-Forwarded-Server",
  "X-Railway-Edge",
  "X-Railway-Request-Id",
  "X-Real-Ip",
  "X-Request-Start",
  "Cdn-Loop",
  "Cf-Connecting-Ip",
  "Cf-Ipcountry",
  "Cf-Ray",
  "Cf-Visitor",
];

export const isServerHeader = (name: string) =>
  SERVER_HEADERS.some((h) => h.toLowerCase() === name.toLowerCase());

export function headerValue(headers: Record<string, string> | undefined, name: string) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

export function queryString(query: Record<string, unknown> | undefined) {
  const entries = Object.entries(query ?? {});
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${String(v)}`).join("&");
}

/** Path as typed by the sender, always starting with "/". */
export const requestPath = (m: WebhookMessage) => "/" + (m.path ?? "").replace(/^\/+/, "");

const pad = (n: number) => String(n).padStart(2, "0");

export function formatTime(time: number | string) {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDateTime(time: number | string) {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(time)}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const hookUrl = (webhookId: string) => `${SERVER_URL}/${webhookId}`;
