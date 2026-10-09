import { Icon, InlineSpinner } from "@/components/icons";
import { Tag } from "@/components/common";
import { useCopy } from "@/hooks/useCopy";
import { ConnectionStatus } from "@/hooks/useWebSocket";
import { SERVER_URL, hookUrl } from "@/lib/http";

const STATUS = {
  connected: { bg: "#044317", fg: "#a7f0ba", label: "Connected" },
  connecting: { bg: "#393939", fg: "#f4f4f4", label: "Connecting" },
  disconnected: { bg: "#750e13", fg: "#ffd7d9", label: "Disconnected" },
};

export default function UrlBar({
  webhookId,
  status,
  retryIn,
  onEdit,
}: {
  webhookId: string;
  status: ConnectionStatus;
  retryIn: number | null;
  onEdit: () => void;
}) {
  const { copied, copy } = useCopy();
  const s = STATUS[status];
  const help =
    status === "connected"
      ? "Listening for requests"
      : status === "connecting"
        ? "Opening WebSocket"
        : `Retrying in ${retryIn ?? 0} s`;

  return (
    <section
      aria-label="Webhook URL"
      className="flex shrink-0 flex-wrap items-end gap-x-6 gap-y-4 border-b border-border-subtle bg-layer-1 p-4"
    >
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2">
        <span className="label-01">Your webhook URL</span>
        <div className="relative flex h-10 max-w-[760px] items-stretch bg-layer-2">
          <span className="flex min-w-0 flex-1 items-center truncate px-4 font-mono text-compact">
            <span className="text-text-helper">{SERVER_URL}/</span>
            <span className="truncate">{webhookId}</span>
          </span>
          <button
            type="button"
            onClick={() => copy(hookUrl(webhookId))}
            aria-label="Copy webhook URL"
            className="btn btn-ghost-on-layer w-10 shrink-0 justify-center"
          >
            <Icon name={copied ? "checkmark" : "copy"} style={{ color: copied ? "#42be65" : undefined }} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Set custom webhook path"
            className="btn btn-ghost-on-layer w-10 shrink-0 justify-center border-l border-solid border-[#525252]"
          >
            <Icon name="edit" />
          </button>
          {copied && (
            <span
              role="status"
              className="tip-in absolute right-6 top-[46px] z-10 whitespace-nowrap bg-inverse px-3 py-2 text-label text-text-inverse"
            >
              Copied to clipboard
            </span>
          )}
        </div>
      </div>
      <div className="flex h-10 items-center gap-4">
        <Tag bg={s.bg} fg={s.fg}>
          {status === "connecting" ? (
            <InlineSpinner size={12} color="currentColor" track={false} />
          ) : (
            <span
              className={status === "connected" ? "live-dot h-[6px] w-[6px] rounded-full" : "h-[6px] w-[6px] rounded-full"}
              style={{ background: "currentColor" }}
            />
          )}
          {s.label}
        </Tag>
        <span className="font-mono text-label text-text-helper">{help}</span>
      </div>
    </section>
  );
}
