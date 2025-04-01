export interface WebhookMessage {
  headers: Record<string, string>;
  body: Record<string, any>;
  host: string;
  path: string;
  method: string;
  time: string;
  id: string;
  protocol: string;
  queryParams: Record<string, string>;
  formData: Record<string, string>;
}

export const methodColors: { [key: string]: string } = {
  GET: "#5bc0de",
  POST: "#5cb85c",
  PUT: "#f0ad4e",
  PATCH: "#607b59",
  DELETE: "#a71b17",
  HEAD: "#1f5b8f",
  OPTIONS: "#777",
};
