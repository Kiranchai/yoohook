import { Icon, StatusIcon } from "@/components/icons";

export type NotificationKind = "info" | "success" | "error" | "warning";

const BORDER: Record<NotificationKind, string> = {
  info: "#0043ce",
  success: "#24a148",
  error: "#da1e28",
  warning: "#f1c21b",
};

/** Carbon high-contrast toast notification. */
export default function ToastNotification({
  kind,
  title,
  subtitle,
  caption,
  mono,
  onClose,
}: {
  kind: NotificationKind;
  title: string;
  subtitle?: string;
  caption?: string;
  mono?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className="flex w-[360px] max-w-[calc(100vw-32px)] gap-3 bg-inverse py-[14px] pl-[13px] font-sans text-text-inverse shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
      style={{ borderLeft: `3px solid ${BORDER[kind]}` }}
    >
      <StatusIcon kind={kind} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-compact">
        <span className="font-semibold">{title}</span>
        {subtitle && <span className={mono ? "truncate font-mono text-[13px]" : "truncate"}>{subtitle}</span>}
        {caption && <span className="text-label text-[#525252]">{caption}</span>}
      </div>
      <button
        type="button"
        aria-label="Close notification"
        onClick={onClose}
        className="-mt-2 mr-1 grid h-8 w-8 shrink-0 place-items-center bg-transparent text-text-inverse hover:bg-[#e8e8e8]"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
