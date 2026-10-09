import { useMemo, useState } from "react";
import { WebhookMessage } from "@/types/webhook";
import { formatBytes, formatDateTime, headerValue, queryString, requestPath } from "@/lib/http";
import { describeBody } from "@/lib/body";
import { buildCurl } from "@/lib/curl";
import { useCopy } from "@/hooks/useCopy";
import { Icon } from "@/components/icons";
import { EmptyNote, KeyValueTable, MethodTag } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import BodyPanel from "./BodyPanel";
import HeadersPanel from "./HeadersPanel";
import ResponsePanel from "./ResponsePanel";

type TabKey = "body" | "headers" | "query" | "form" | "response";

const TAB_WIDTH = 160;

const CURL_COLORS = { command: "#0043ce", flag: "#161616", value: "#198038", break: "#525252" };

function formValue(value: unknown) {
  const file = value as { originalname?: string; mimetype?: string; size?: number } | null;
  if (file && typeof file === "object" && file.originalname) {
    return `${file.originalname} · ${file.mimetype ?? "file"} · ${formatBytes(file.size ?? 0)}`;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

export default function RequestDetails({
  message,
  webhookId,
  onEditResponse,
}: {
  message: WebhookMessage;
  webhookId: string;
  onEditResponse: (method: string, endpoint: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>("body");
  const [pretty, setPretty] = useState(true);
  const link = useCopy();
  const cmd = useCopy();

  const path = requestPath(message);
  const query = queryString(message.queryParams);
  const fullPath = path + query;
  const longPath = fullPath.length > 60;
  const curl = useMemo(() => buildCurl(message, webhookId), [message, webhookId]);

  const bodyView = useMemo(() => describeBody(message, true), [message]);
  const bodyCount =
    bodyView.kind === "binary"
      ? formatBytes(bodyView.bytes.length)
      : bodyView.kind === "text"
        ? formatBytes(bodyView.bytes)
        : "";

  const tabs: { key: TabKey; label: string; count: string | number }[] = [
    { key: "body", label: "Body", count: bodyCount.replace(" bytes", " B") },
    { key: "headers", label: "Headers", count: Object.keys(message.headers ?? {}).length },
    { key: "query", label: "Query", count: Object.keys(message.queryParams ?? {}).length },
    { key: "form", label: "Form data", count: Object.keys(message.formData ?? {}).length },
    { key: "response", label: "Response", count: message.response?.status ?? "—" },
  ];
  const tabIndex = tabs.findIndex((t) => t.key === tab);

  return (
    <div key={message.id} className="enter-up max-w-[1200px] p-8">
      <span className="label-01">Request</span>
      <div className="mt-2 flex min-w-0 items-start gap-4">
        <span className="mt-[6px]">
          <MethodTag method={message.method} />
        </span>
        <h1
          title={fullPath}
          className="m-0 line-clamp-3 min-w-0 flex-1 break-all font-mono font-normal"
          style={{ fontSize: longPath ? 20 : 28, lineHeight: longPath ? "28px" : "36px" }}
        >
          {path}
          <span className="text-text-helper">{query}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-px">
          <button
            type="button"
            onClick={() => link.copy(`${window.location.origin}/${webhookId}/${message.id}`)}
            title="Copy a link to this request"
            className="btn btn-ghost h-10 whitespace-nowrap px-3"
            style={{ color: link.copied ? "#42be65" : "#78a9ff" }}
          >
            <Icon name={link.copied ? "checkmark" : "link"} />
            {link.copied ? "Link copied" : "Copy link"}
          </button>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => cmd.copy(curl.text)}
                className="btn btn-ghost h-10 whitespace-nowrap px-3"
                style={{ color: cmd.copied ? "#42be65" : "#78a9ff" }}
              >
                <Icon name={cmd.copied ? "checkmark" : "code"} />
                {cmd.copied ? "Copied" : "Copy as cURL"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="w-[560px] p-0">
              <div className="flex justify-between px-3 pt-2 text-label text-[#525252]">
                <span>Click to copy</span>
                <span className="font-mono">{curl.lineCount} lines</span>
              </div>
              <pre className="m-0 max-h-60 overflow-hidden whitespace-pre-wrap break-all px-3 pb-3 pt-2 font-mono text-label leading-[18px]">
                {curl.parts.map((p, i) => (
                  <span key={i} style={{ color: CURL_COLORS[p.kind] }}>
                    {p.text}
                  </span>
                ))}
              </pre>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <dl className="mb-0 mt-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-8 gap-y-4 border-y border-border-subtle py-4">
        <Meta label="Received" value={formatDateTime(message.time)} />
        <Meta label="Request ID" value={message.id} />
        <Meta label="Source IP" value={headerValue(message.headers, "X-Forwarded-For")?.split(",")[0].trim() ?? "—"} />
        <Meta label="Content type" value={headerValue(message.headers, "Content-Type")?.split(";")[0] ?? "—"} />
      </dl>

      <div role="tablist" aria-label="Request sections" className="relative mt-8 flex overflow-x-auto">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className="flex h-10 shrink-0 items-center gap-2 border-0 border-b-2 border-solid border-layer-2 bg-transparent px-4 text-left transition-colors duration-70 hover:bg-layer-1 hover:text-text-primary"
              style={{ width: TAB_WIDTH, color: active ? "#f4f4f4" : "#c6c6c6", fontWeight: active ? 600 : 400 }}
            >
              {t.label}
              <span className="font-mono text-label font-normal text-text-helper">{t.count}</span>
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-[2px] bg-border-interactive transition-transform duration-240 ease-productive"
          style={{ width: TAB_WIDTH, transform: `translateX(${tabIndex * TAB_WIDTH}px)` }}
        />
      </div>

      {tab === "body" && <BodyPanel message={message} pretty={pretty} onPrettyChange={setPretty} />}
      {tab === "headers" && <HeadersPanel headers={message.headers} />}
      {tab === "query" && (
        <KvSection
          rows={Object.entries(message.queryParams ?? {}).map(([k, v]) => [k, String(v)])}
          keyLabel="Key"
          empty="This request has no query parameters."
        />
      )}
      {tab === "form" && (
        <KvSection
          rows={Object.entries(message.formData ?? {}).map(([k, v]) => [k, formValue(v)])}
          keyLabel="Field"
          empty="This request has no form data."
        />
      )}
      {tab === "response" && (
        <ResponsePanel message={message} onEditResponse={() => onEditResponse(message.method, path)} />
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="label-01">{label}</dt>
      <dd className="m-0 truncate font-mono">{value}</dd>
    </div>
  );
}

function KvSection({ rows, keyLabel, empty }: { rows: [string, string][]; keyLabel: string; empty: string }) {
  return (
    <section className="enter-fade mt-4">
      {rows.length ? <KeyValueTable rows={rows} keyLabel={keyLabel} /> : <EmptyNote>{empty}</EmptyNote>}
    </section>
  );
}
