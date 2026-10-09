import { StatusIcon } from "@/components/icons";

/** Carbon inline error notification shown under the URL bar while offline. */
export default function ConnectionNotice({ retryIn, onRetry }: { retryIn: number | null; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="enter-up flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-background bg-layer-2 pl-[13px]"
      style={{ borderLeft: "3px solid #fa4d56" }}
    >
      <StatusIcon kind="error" />
      <span className="font-semibold">Connection lost.</span>
      <span>
        Retrying in <span className="font-mono">{retryIn ?? 0} s</span>. Requests sent while offline won't appear here.
      </span>
      <button type="button" onClick={onRetry} className="btn btn-ghost-on-layer ml-auto h-12 px-4 text-link">
        Retry now
      </button>
    </div>
  );
}
