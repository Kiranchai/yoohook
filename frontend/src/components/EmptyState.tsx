import { Icon, InlineSpinner } from "@/components/icons";
import { useCopy } from "@/hooks/useCopy";
import { hookUrl } from "@/lib/http";

export default function EmptyState({
  webhookId,
  onOpenResponses,
}: {
  webhookId: string;
  onOpenResponses: () => void;
}) {
  const { copied, copy } = useCopy();
  const url = hookUrl(webhookId);
  const curl = `curl -X POST ${url} -H "Content-Type: application/json" -d '{"hello": "yoohook"}'`;

  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-16">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
        <svg className="enter-stagger" width="80" height="80" viewBox="0 0 80 80" fill="none" strokeWidth="2" aria-hidden="true">
          <path d="M8 40h20l4 8h16l4-8h20" stroke="#f4f4f4" />
          <path d="M8 40v30h64V40L62 22H18z" stroke="#f4f4f4" strokeLinejoin="round" />
          <g className="drop">
            <path d="M40 4v24" stroke="#4589ff" />
            <path d="m32 20 8 8 8-8" stroke="#4589ff" />
          </g>
        </svg>

        <div className="enter-stagger flex max-w-[640px] flex-col gap-3" style={{ animationDelay: "70ms" }}>
          <h1 className="m-0 text-[32px] font-light leading-10">Waiting for your first request</h1>
          <p className="m-0 text-base leading-6 text-text-secondary">
            Send any HTTP request to your webhook URL. It appears here as soon as it arrives.
          </p>
          <span className="flex items-center gap-2 text-text-secondary">
            <InlineSpinner />
            Listening on {webhookId.slice(0, 8)}
          </span>
        </div>

        <div className="enter-stagger max-w-[760px] bg-layer-1" style={{ animationDelay: "140ms" }}>
          <div className="flex h-10 items-center justify-between border-b border-border-subtle pl-4">
            <span className="label-01">Try it from a terminal</span>
            <button
              type="button"
              onClick={() => copy(curl)}
              className="btn btn-ghost h-10 px-4"
              style={{ color: copied ? "#42be65" : "#78a9ff" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="m-0 whitespace-pre-wrap break-all p-4 font-mono text-[14px] leading-5">
            {`curl -X POST ${url} \\\n  -H `}
            <span className="text-[#6fdc8c]">"Content-Type: application/json"</span>
            {` \\\n  -d `}
            <span className="text-[#6fdc8c]">{`'{"hello": "yoohook"}'`}</span>
          </pre>
        </div>

        <div
          className="enter-stagger grid grid-cols-3 gap-px bg-layer-2"
          style={{ animationDelay: "210ms" }}
        >
          <Step n="01" title="Copy your URL" text="Point any service or script at it." />
          <Step n="02" title="Inspect in real time" text="Headers, query, form data and body." />
          <button
            type="button"
            onClick={onOpenResponses}
            className="flex min-h-32 flex-col gap-2 bg-layer-1 p-4 text-left text-text-primary transition-colors duration-70 hover:bg-layer-hover1"
          >
            <span className="font-mono text-label text-link">03</span>
            <span className="text-base leading-[22px]">Mock the response</span>
            <span className="text-text-secondary">Set status, headers and body per endpoint.</span>
            <Icon name="arrowRight" size={20} className="mt-auto self-end text-link" />
          </button>
        </div>
      </div>
    </main>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex min-h-32 flex-col gap-2 bg-layer-1 p-4">
      <span className="font-mono text-label text-link">{n}</span>
      <span className="text-base leading-[22px]">{title}</span>
      <span className="text-text-secondary">{text}</span>
    </div>
  );
}
