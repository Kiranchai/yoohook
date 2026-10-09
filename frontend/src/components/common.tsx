import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CodeLine } from "@/lib/body";
import { methodChip, methodTag } from "@/lib/http";

/** Square, fixed-width method chip used in lists. */
export function MethodChip({ method, className }: { method: string; className?: string }) {
  const { bg, fg } = methodChip(method);
  return (
    <span
      className={cn(
        "grid h-5 w-16 shrink-0 place-items-center font-mono text-[11px] font-medium tracking-[0.5px]",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {method}
    </span>
  );
}

/** Rounded Carbon tag for a method (detail header). */
export function MethodTag({ method }: { method: string }) {
  const { bg, fg } = methodTag(method);
  return (
    <span
      className="grid h-6 shrink-0 place-items-center rounded-full px-[10px] text-label"
      style={{ background: bg, color: fg }}
    >
      {method}
    </span>
  );
}

export function Tag({
  children,
  bg,
  fg,
  className,
}: {
  children: ReactNode;
  bg: string;
  fg: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-label", className)}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/** Small Carbon toggle. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-12 items-center gap-2 bg-transparent px-4 text-compact disabled:opacity-40"
    >
      <span
        className="relative h-4 w-8 rounded-full transition-colors duration-110 ease-productive"
        style={{ background: checked ? "#24a148" : "#8d8d8d" }}
      >
        <span
          className="absolute left-[3px] top-[3px] h-[10px] w-[10px] rounded-full bg-white transition-transform duration-110 ease-productive"
          style={{ transform: `translateX(${checked ? 16 : 0}px)` }}
        />
      </span>
      {label}
    </button>
  );
}

/** Numbered, syntax-coloured code listing. */
export function CodeBlock({ lines, wrap = false, className }: { lines: CodeLine[]; wrap?: boolean; className?: string }) {
  return (
    <div className={cn("overflow-x-auto py-4 font-mono text-[14px] leading-5", className)}>
      {lines.map((line, i) => (
        <div key={i} className="flex min-w-max pr-4">
          <span className="w-16 shrink-0 select-none pr-4 text-right text-text-placeholder">{i + 1}</span>
          <span className={wrap ? "max-w-[960px] whitespace-pre-wrap break-all" : "whitespace-pre"}>
            {line.map((seg, j) => (
              <span key={j} style={{ color: seg.color, fontStyle: seg.italic ? "italic" : undefined }}>
                {seg.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function KeyValueTable({
  rows,
  keyLabel = "Name",
  valueLabel = "Value",
  muted = false,
  header = true,
}: {
  rows: [string, ReactNode][];
  keyLabel?: string;
  valueLabel?: string;
  muted?: boolean;
  header?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-layer-1">
        {header && (
          <thead>
            <tr className="h-12 bg-layer-2">
              <th scope="col" className="w-[32%] px-4 text-left text-compact font-semibold">
                {keyLabel}
              </th>
              <th scope="col" className="px-4 text-left text-compact font-semibold">
                {valueLabel}
              </th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b border-border-subtle transition-colors duration-70 hover:bg-layer-hover1">
              <td
                className={cn(
                  "px-4 py-[15px] align-top font-mono text-[13px] [overflow-wrap:anywhere]",
                  muted ? "text-text-helper" : "text-text-secondary",
                )}
              >
                {key}
              </td>
              <td
                className={cn(
                  "px-4 py-[15px] align-top font-mono text-[13px] [overflow-wrap:anywhere]",
                  muted && "text-text-secondary",
                )}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="m-0 bg-layer-1 px-4 py-8 text-text-secondary">{children}</p>;
}
