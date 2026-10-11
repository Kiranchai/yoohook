/** What the backend answered the webhook sender with. */
export interface WebhookResponse {
  status: number;
  headers: Record<string, string>;
  /** True when a custom response configured in yoohook was used. */
  custom: boolean;
  /** True for the default reply, which echoes the request back as `payload`. */
  echo?: boolean;
  body?: unknown;
  bodyFormat?: string;
  durationMs?: number;
}

/** Node `Buffer` serialised by JSON.stringify (raw/binary bodies). */
export interface BufferBody {
  type: "Buffer";
  data: number[];
  /** Full size in bytes when the backend forwarded only the first part. */
  size?: number;
  truncated?: boolean;
}

export interface WebhookMessage {
  headers: Record<string, string>;
  body: unknown;
  host: string;
  path: string;
  fullPath?: string;
  method: string;
  time: number | string;
  id: string;
  protocol: string;
  queryParams: Record<string, string>;
  formData: Record<string, unknown>;
  /** Decoded `Authorization: Basic …` credentials, when sent. */
  basicAuth?: { username: string; password: string };
  /** Present when the backend reports its response (newer backends). */
  response?: WebhookResponse;
}
