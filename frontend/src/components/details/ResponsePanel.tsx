import { WebhookMessage } from "@/types/webhook";
import { CodeLine, SYNTAX, jsonLines } from "@/lib/body";
import { formatBytes, reasonPhrase, statusColor } from "@/lib/http";
import { CodeBlock, EmptyNote, KeyValueTable, Tag } from "@/components/common";

function responseLines(message: WebhookMessage): CodeLine[] {
  const r = message.response!;
  if (r.echo) {
    const size = new TextEncoder().encode(JSON.stringify({ ...message, response: undefined })).length;
    const p = SYNTAX.punctuation;
    return [
      [{ text: "{", color: p }],
      [
        { text: '  "status"', color: SYNTAX.key },
        { text: ": ", color: p },
        { text: '"Webhook received"', color: SYNTAX.string },
        { text: ",", color: p },
      ],
      [
        { text: '  "payload"', color: SYNTAX.key },
        { text: ": ", color: p },
        { text: "{ … }", color: p },
        { text: `   echo of this request · ${formatBytes(size)}`, color: SYNTAX.comment, italic: true },
      ],
      [{ text: "}", color: p }],
    ];
  }
  const body = r.body;
  if (body === undefined || body === null || body === "") return [];
  if (typeof body === "object") return jsonLines(body);
  const text = String(body);
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return jsonLines(parsed);
  } catch {
    /* not JSON: show as text */
  }
  return text.split("\n").map((line) => [{ text: line || " ", color: SYNTAX.text }]);
}

export default function ResponsePanel({
  message,
  onEditResponse,
}: {
  message: WebhookMessage;
  onEditResponse: () => void;
}) {
  const r = message.response;

  if (!r) {
    return (
      <section className="enter-fade mt-4">
        <EmptyNote>
          The response wasn't recorded for this request. Requests received from now on show what yoohook answered.
        </EmptyNote>
      </section>
    );
  }

  const lines = responseLines(message);

  return (
    <section className="enter-fade mt-4 flex flex-col gap-6">
      <div className="flex flex-wrap items-stretch bg-layer-1">
        <div className="flex flex-col justify-center gap-1 border-r border-border-subtle py-4 pl-4 pr-6">
          <span className="label-01">Status</span>
          <span className="font-mono text-[28px] leading-9" style={{ color: statusColor(r.status) }}>
            {r.status} <span className="text-compact text-text-secondary">{reasonPhrase(r.status)}</span>
          </span>
        </div>
        <div className="flex flex-[1_1_320px] flex-col justify-center gap-2 px-6 py-4">
          <span className="flex flex-wrap items-center gap-2">
            <Tag bg={r.custom ? "#0043ce" : "#393939"} fg={r.custom ? "#d0e2ff" : "#f4f4f4"} className="px-[10px]">
              {r.custom ? "Custom response" : "Default response"}
            </Tag>
            <span className="text-text-secondary">
              {r.custom
                ? `Set for ${message.method} /${message.path}`
                : "No custom response for this endpoint, so yoohook echoed the request back."}
            </span>
          </span>
          <button
            type="button"
            onClick={onEditResponse}
            className="self-start bg-transparent p-0 text-compact text-link hover:text-link-hover hover:underline"
          >
            {r.custom ? "Edit custom response" : "Set a custom response"}
          </button>
        </div>
        {r.durationMs !== undefined && (
          <div className="flex flex-col justify-center gap-1 border-l border-border-subtle px-6 py-4">
            <span className="label-01">Sent in</span>
            <span className="font-mono text-xl leading-7">{r.durationMs} ms</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-compact font-semibold">Response headers</h3>
        <KeyValueTable rows={Object.entries(r.headers ?? {}).map(([k, v]) => [k, v])} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-compact font-semibold">Response body</h3>
        {lines.length > 0 ? (
          <div className="bg-layer-1">
            <CodeBlock lines={lines} />
          </div>
        ) : (
          <EmptyNote>
            No body.{r.status === 204 && <> A <span className="font-mono">204</span> response never carries one.</>}
          </EmptyNote>
        )}
      </div>
    </section>
  );
}
