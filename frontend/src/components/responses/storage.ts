import { SERVER_URL } from "@/lib/http";
import type { SpecVariant } from "@/lib/openapi";

export type BodyFormat = "json" | "xml" | "text" | "html" | "yaml" | "form-urlencoded" | "raw";

export interface SavedResponse {
  method: string;
  /** Normalised path, may contain `{param}` segments. */
  endpoint: string;
  statusCode: string;
  headers: Record<string, string>;
  body: unknown;
  bodyFormat: BodyFormat;
  /** Missing for responses set by hand. */
  source?: "openapi";
  spec?: { title: string; version: string; basePath: string };
  operationId?: string;
  summary?: string;
  tag?: string;
  /** Every response the specification defines, to switch between them. */
  variants?: SpecVariant[];
  exampleName?: string;
  /** Edited by hand after the import, so it no longer matches the specification. */
  overridden?: boolean;
}

type EndpointKey = { method: string; endpoint: string };

const LEGACY_KEY = "customResponses";
const keyFor = (webhookId: string) => `customResponses:${webhookId}`;

export const normalisePath = (path: string) => "/" + path.split("/").filter(Boolean).join("/");

export function loadResponses(webhookId: string): SavedResponse[] {
  try {
    const own = localStorage.getItem(keyFor(webhookId));
    if (own) return JSON.parse(own);
    // Older versions kept one list for every webhook: adopt it once.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    const list: SavedResponse[] = JSON.parse(legacy).map((r: SavedResponse) => ({
      ...r,
      endpoint: normalisePath(r.endpoint),
    }));
    localStorage.setItem(keyFor(webhookId), JSON.stringify(list));
    localStorage.removeItem(LEGACY_KEY);
    return list;
  } catch {
    return [];
  }
}

export function saveResponses(webhookId: string, responses: SavedResponse[]) {
  try {
    if (responses.length) localStorage.setItem(keyFor(webhookId), JSON.stringify(responses));
    else localStorage.removeItem(keyFor(webhookId));
  } catch {
    /* storage full or blocked: the server copy still works until a restart */
  }
}

export const sameEndpoint = (a: EndpointKey, b: EndpointKey) =>
  a.method === b.method && normalisePath(a.endpoint) === normalisePath(b.endpoint);

export const endpointKey = (e: EndpointKey) => `${e.method} ${normalisePath(e.endpoint)}`;

const toServer = (r: SavedResponse) => ({
  method: r.method,
  endpoint: r.endpoint,
  statusCode: r.statusCode,
  headers: r.headers,
  body: r.body,
  bodyFormat: r.bodyFormat,
});

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Server responded ${res.status}.`);
  return data;
}

/** Keys ("METHOD /path") of the custom responses the server currently answers with. */
export async function fetchActive(webhookId: string): Promise<Set<string>> {
  const data = await request(`${SERVER_URL}/responses/${webhookId}`);
  return new Set((data.responses ?? []).map(endpointKey));
}

/** Adds or updates many responses on the server without touching the others. */
export async function pushResponses(webhookId: string, responses: SavedResponse[]) {
  if (!responses.length) return;
  await request(`${SERVER_URL}/responses/${webhookId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses: responses.map(toServer) }),
  });
}

export async function pushResponse(webhookId: string, r: SavedResponse) {
  await request(`${SERVER_URL}/set-response/${webhookId}/${r.method}${r.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toServer(r)),
  });
}

export async function deleteResponse(webhookId: string, r: EndpointKey) {
  await fetch(`${SERVER_URL}/delete-response/${webhookId}/${r.method}${r.endpoint}`, { method: "DELETE" });
}

export async function deleteAllResponses(webhookId: string) {
  await request(`${SERVER_URL}/delete-responses/${webhookId}`, { method: "DELETE" });
}

/** Turns a spec variant into the body/headers yoohook answers with. */
export function applyVariant(r: SavedResponse, variant: SpecVariant, exampleName?: string): SavedResponse {
  const name = variant.examples ? (exampleName && exampleName in variant.examples ? exampleName : Object.keys(variant.examples)[0]) : undefined;
  return {
    ...r,
    statusCode: variant.statusCode,
    headers: { ...variant.headers },
    body: name ? variant.examples![name] : variant.body ?? "",
    bodyFormat: variant.bodyFormat,
    exampleName: name,
    overridden: false,
  };
}

export const activeVariant = (r: SavedResponse) => r.variants?.find((v) => v.statusCode === r.statusCode);

/** The body the specification would answer with for the current status and example. */
export const specBody = (r: SavedResponse) => {
  const v = activeVariant(r);
  if (!v) return undefined;
  return v.examples && r.exampleName ? v.examples[r.exampleName] : v.body ?? "";
};
