import { useMemo, useState } from "react";
import { WebhookMessage } from "@/types/webhook";
import { bytesToBase64, describeBody, hexDump } from "@/lib/body";
import { formatBytes } from "@/lib/http";
import { useCopy } from "@/hooks/useCopy";
import { Icon, StatusIcon } from "@/components/icons";
import { CodeBlock, EmptyNote, Toggle } from "@/components/common";
import { cn } from "@/lib/utils";

const COLLAPSED_LINES = 40;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

export default function BodyPanel({
  message,
  pretty,
  onPrettyChange,
}: {
  message: WebhookMessage;
  pretty: boolean;
  onPrettyChange: (pretty: boolean) => void;
}) {
  const view = useMemo(() => describeBody(message, pretty), [message, pretty]);
  const [expanded, setExpanded] = useState(false);
  const { copied, copy } = useCopy();

  const download = (bytes: number[], contentType: string) => {
    const type = contentType.split(";")[0];
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `body-${message.id.slice(0, 8)}.${EXTENSIONS[type] ?? "bin"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  let meta = "0 bytes";
  if (view.kind === "binary") meta = formatBytes(view.bytes.length);
  if (view.kind === "text") {
    meta = `${view.wrap ? "1 line" : `${view.lines.length.toLocaleString("en-US")} lines`} · ${formatBytes(view.bytes)}`;
  }

  const collapsible = view.kind === "text" && view.lines.length > COLLAPSED_LINES;
  const lines =
    view.kind === "text" ? (collapsible && !expanded ? view.lines.slice(0, COLLAPSED_LINES) : view.lines) : [];

  return (
    <section className="enter-fade mt-4 flex flex-col gap-4">
      {view.kind === "text" && view.invalidJson && (
        <div role="status" className="flex gap-3 bg-layer-2 py-[14px] pl-[13px] pr-4" style={{ borderLeft: "3px solid #f1c21b" }}>
          <StatusIcon kind="warning" />
          <div className="flex min-w-0 flex-col gap-1">
            <span>
              <span className="font-semibold">Body isn't valid JSON.</span> The request says{" "}
              <span className="font-mono">application/json</span>, so it's shown raw.
            </span>
            <span className="font-mono text-label text-text-secondary [overflow-wrap:anywhere]">{view.invalidJson}</span>
          </div>
        </div>
      )}

      <div className="bg-layer-1">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border-subtle pl-4">
          <span className="font-mono text-label text-text-helper">{meta}</span>
          <div className="flex items-center">
            {view.kind === "text" && (
              <Toggle checked={pretty} onChange={onPrettyChange} label="Pretty print" disabled={!view.prettyAvailable} />
            )}
            {view.kind !== "none" && (
              <button
                type="button"
                onClick={() => copy(view.kind === "binary" ? bytesToBase64(view.bytes) : view.copyText)}
                className="btn btn-ghost-on-layer h-12 border-l border-solid border-border-subtle px-4"
                style={{ color: copied ? "#42be65" : undefined }}
              >
                {copied ? "Copied" : view.kind === "binary" ? "Copy as Base64" : "Copy"}
                <Icon name={copied ? "checkmark" : "copy"} />
              </button>
            )}
          </div>
        </div>

        {view.kind === "text" && (
          <>
            <div className={cn(collapsible && !expanded && "fade-bottom")}>
              <CodeBlock lines={lines} wrap={view.wrap} />
            </div>
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="btn btn-ghost-on-layer h-12 w-full border-t border-solid border-border-subtle px-4 text-link"
              >
                {expanded ? "Collapse" : `Show all ${view.lines.length.toLocaleString("en-US")} lines`}
                <Icon
                  name="chevronDown"
                  className="transition-transform duration-240 ease-productive"
                  style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                />
              </button>
            )}
          </>
        )}

        {view.kind === "binary" && (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-4 px-4 py-6">
              <Icon name="image" size={48} className="text-text-secondary" />
              <div className="flex flex-col gap-1">
                <span className="text-base leading-[22px]">Binary body</span>
                <span className="font-mono text-label text-text-secondary">
                  {view.contentType} · {formatBytes(view.bytes.length)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => download(view.bytes, view.contentType)}
                className="btn btn-tertiary ml-auto h-10 gap-8 px-4"
              >
                Download file
                <Icon name="download" />
              </button>
            </div>
            <span className="label-01 px-4 pb-2">First {Math.min(128, view.bytes.length)} bytes</span>
            <div className="overflow-x-auto pb-4 font-mono text-[13px] leading-5">
              {hexDump(view.bytes).map((row) => (
                <div key={row.offset} className="flex min-w-max gap-6 px-4">
                  <span className="text-text-placeholder">{row.offset}</span>
                  <span className="whitespace-pre">{row.hex}</span>
                  <span className="whitespace-pre text-text-helper">{row.ascii}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view.kind === "none" && <EmptyNote>This request has no body.</EmptyNote>}
      </div>
    </section>
  );
}
