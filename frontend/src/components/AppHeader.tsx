import { Icon } from "@/components/icons";

export default function AppHeader({
  onNewUrl,
  onOpenResponses,
}: {
  onNewUrl: () => void;
  onOpenResponses: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-stretch border-b border-border-subtle bg-background">
      <a href="/" className="flex items-center px-4 text-compact tracking-[0.1px] text-text-primary no-underline">
        yoo<span className="font-semibold">hook</span>
      </a>
      <span className="my-3 w-px bg-layer-2" />
      <nav aria-label="Primary" className="flex items-stretch">
        <span
          aria-current="page"
          className="flex items-center bg-layer-1 px-4 text-compact text-text-primary shadow-[inset_0_-3px_0_#0f62fe]"
        >
          Inspector
        </span>
        <button
          type="button"
          onClick={onOpenResponses}
          className="flex items-center bg-transparent px-4 text-compact text-text-secondary transition-colors duration-70 hover:bg-layer-hover1 hover:text-text-primary"
        >
          Custom responses
        </button>
      </nav>
      <div className="ml-auto flex items-stretch">
        <button
          type="button"
          onClick={onNewUrl}
          aria-label="Generate new URL"
          title="Generate new URL"
          className="btn btn-ghost w-12 justify-center"
        >
          <Icon name="renew" size={20} />
        </button>
        <button
          type="button"
          onClick={onOpenResponses}
          aria-label="Custom responses"
          title="Custom responses"
          className="btn btn-ghost w-12 justify-center"
        >
          <Icon name="settings" size={20} />
        </button>
      </div>
    </header>
  );
}
