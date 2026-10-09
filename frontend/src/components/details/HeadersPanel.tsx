import { useState } from "react";
import { Icon } from "@/components/icons";
import { EmptyNote, KeyValueTable } from "@/components/common";
import { isServerHeader } from "@/lib/http";

const FILTER_THRESHOLD = 10;

export default function HeadersPanel({ headers }: { headers: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [serverOpen, setServerOpen] = useState(false);

  const entries = Object.entries(headers ?? {});
  const own = entries.filter(([k]) => !isServerHeader(k));
  const server = entries.filter(([k]) => isServerHeader(k));
  const q = query.trim().toLowerCase();
  const shown = q ? own.filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)) : own;

  return (
    <section className="enter-fade mt-4 flex flex-col gap-6">
      <div>
        {own.length > FILTER_THRESHOLD && (
          <div className="flex h-12 items-stretch border-b border-border-subtle bg-layer-1">
            <label className="flex flex-1 items-center gap-3 pl-4 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-white">
              <Icon name="search" className="text-text-secondary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter headers"
                placeholder="Filter headers by name or value"
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-compact text-text-primary outline-none placeholder:text-text-placeholder"
              />
            </label>
            <span className="flex items-center whitespace-nowrap px-4 font-mono text-label text-text-helper">
              {shown.length === own.length ? `${own.length} headers` : `${shown.length} of ${own.length}`}
            </span>
          </div>
        )}
        {shown.length > 0 ? (
          <KeyValueTable rows={shown.map(([k, v]) => [k, String(v)])} />
        ) : (
          <EmptyNote>{own.length ? `No headers match “${query}”.` : "This request has no headers."}</EmptyNote>
        )}
      </div>

      {server.length > 0 && (
        <div className="border-y border-border-subtle">
          <button
            type="button"
            onClick={() => setServerOpen((o) => !o)}
            aria-expanded={serverOpen}
            className="btn btn-ghost min-h-10 w-full px-4 text-left"
          >
            Proxy and server headers <span className="font-mono text-label text-text-helper">{server.length}</span>
            <Icon
              name="chevronDown"
              className="ml-auto transition-transform duration-240 ease-productive"
              style={{ transform: serverOpen ? "rotate(180deg)" : undefined }}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-240 ease-productive"
            style={{ gridTemplateRows: serverOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <p className="m-0 px-4 pb-3 text-label text-text-secondary">Added by the edge network, not by the sender.</p>
              <div className="mb-4">
                <KeyValueTable rows={server.map(([k, v]) => [k, String(v)])} muted header={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
