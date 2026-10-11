import { useRef, useState } from "react";
import { WebhookMessage } from "@/types/webhook";
import { formatTime, queryString, requestPath, statusColor } from "@/lib/http";
import { Icon } from "@/components/icons";
import { MethodChip } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 64;

export default function RequestList({
  messages,
  selectedId,
  unread,
  freshId,
  dimmed,
  onSelect,
  onDelete,
  onClearAll,
  onMarkAllRead,
}: {
  messages: WebhookMessage[];
  selectedId?: string;
  unread: ReadonlySet<string>;
  freshId: string | null;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onMarkAllRead: () => void;
}) {
  const selectedIndex = Math.max(
    0,
    messages.findIndex((m) => m.id === selectedId),
  );
  const unreadCount = messages.filter((m) => unread.has(m.id)).length;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-layer-1 transition-opacity duration-240 ease-productive"
      style={{ opacity: dimmed ? 0.6 : 1 }}
    >
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border-subtle py-2 pl-4 pr-2">
        <h2 className="m-0 whitespace-nowrap text-compact font-semibold">Requests</h2>
        <span
          key={messages.length}
          className="count-bump grid h-[18px] min-w-6 shrink-0 place-items-center rounded-full bg-layer-2 px-[6px] font-mono text-label"
        >
          {messages.length}
        </span>
        {unreadCount > 0 && (
          <span
            key={`u${unreadCount}`}
            className="count-bump inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#0043ce] px-2 font-mono text-label leading-[18px] text-[#d0e2ff]"
          >
            <span>{unreadCount}</span>
            <span>new</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {unreadCount > 0 && (
            <>
              <button
                type="button"
                onClick={onMarkAllRead}
                title="Mark all as read"
                className="btn btn-ghost h-10 whitespace-nowrap px-3 text-link"
              >
                <Icon name="checkmark" />
                Mark all read
              </button>
              <span className="mx-1 h-6 w-px bg-[#525252]" />
            </>
          )}
          <button
            type="button"
            onClick={onClearAll}
            aria-label="Clear all requests"
            title="Clear all requests"
            className="btn btn-ghost h-10 w-10 justify-center"
          >
            <Icon name="trash" />
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 bg-layer-2 shadow-[inset_3px_0_0_#4589ff] transition-transform duration-240 ease-productive"
            style={{ height: ROW_HEIGHT - 1, transform: `translateY(${selectedIndex * ROW_HEIGHT}px)` }}
          />
          {messages.map((message) => (
            <RequestRow
              key={message.id}
              message={message}
              selected={message.id === selectedId}
              unread={unread.has(message.id)}
              fresh={message.id === freshId}
              onSelect={() => onSelect(message.id)}
              onDelete={() => onDelete(message.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RequestRow({
  message,
  selected,
  unread,
  fresh,
  onSelect,
  onDelete,
}: {
  message: WebhookMessage;
  selected: boolean;
  unread: boolean;
  fresh: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const pathRef = useRef<HTMLSpanElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const path = requestPath(message);
  const query = queryString(message.queryParams);
  const response = message.response;

  const label =
    `${unread ? "Unread: " : ""}${message.method} ${path}${query}` +
    (response ? `, responded ${response.status}${response.custom ? " (custom)" : ""}` : "");

  return (
    <div className={cn("request-row relative h-16 overflow-hidden border-b border-border-subtle", fresh && "row-new")}>
      <Tooltip
        open={tipOpen}
        onOpenChange={(open) => {
          const el = pathRef.current;
          // Only offer the full path when it is actually cut off.
          setTipOpen(open && !!el && el.scrollWidth > el.clientWidth + 1);
        }}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSelect}
            aria-current={selected ? "true" : undefined}
            aria-label={label}
            className="absolute inset-0 flex items-center gap-3 bg-transparent pl-5 pr-[72px] text-left transition-colors duration-70 ease-productive hover:bg-layer-hover1"
          >
            <span
              className="absolute left-[7px] top-1/2 h-[6px] w-[6px] rounded-full bg-[#4589ff] transition-transform duration-110 ease-productive"
              style={{ transform: `translateY(-50%) scale(${unread ? 1 : 0})` }}
            />
            <MethodChip method={message.method} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                ref={pathRef}
                className={cn("truncate font-mono text-[14px] leading-[18px]", unread && "font-semibold")}
              >
                {path + query}
              </span>
              <span className="truncate font-mono text-label text-text-helper">
                {formatTime(message.time)} · {message.id.slice(0, 8)}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" alignOffset={88} className="font-mono text-[13px] leading-[18px]">
          <span className="break-all">
            {path}
            <span className="text-text-placeholder">{query}</span>
          </span>
        </TooltipContent>
      </Tooltip>

      {response && (
        <span
          aria-hidden="true"
          className="row-response pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-end gap-[2px] font-mono transition-opacity duration-110 ease-productive"
        >
          <span className="text-label" style={{ color: statusColor(response.status) }}>
            {response.status}
          </span>
          {response.custom && <span className="text-[11px] leading-[14px] text-[#8d8d8d]">custom</span>}
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${message.method} ${path}`}
        title="Delete"
        className="row-delete btn btn-ghost-on-layer absolute right-2 top-4 z-[2] h-8 w-8 justify-center transition-opacity duration-110"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
