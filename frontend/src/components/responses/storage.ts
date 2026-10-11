export type BodyFormat = "json" | "xml" | "text" | "html" | "yaml" | "form-urlencoded" | "raw";

export interface SavedResponse {
  method: string;
  endpoint: string;
  statusCode: string;
  headers: Record<string, string>;
  body: unknown;
  bodyFormat: BodyFormat;
}

const KEY = "customResponses";

export function loadResponses(): SavedResponse[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveResponses(responses: SavedResponse[]) {
  localStorage.setItem(KEY, JSON.stringify(responses));
}

export const sameEndpoint = (a: { method: string; endpoint: string }, b: { method: string; endpoint: string }) =>
  a.method === b.method && a.endpoint === b.endpoint;
