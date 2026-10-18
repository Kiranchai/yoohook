import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "@/providers/MessagesProvider";
import { methodChip, reasonPhrase, requestPath, statusColor } from "@/lib/http";
import { SOURCES, matchesTemplate, paramText, plural, versionLabel } from "@/lib/openapi";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";
import { MethodChip } from "@/components/common";
import { Modal } from "@/components/ui/modal";
import ResponseEditor, { EditorTarget, ResponseEditorHandle } from "./ResponseEditor";
import ImportOpenApiDialog, { ExampleChips, PathText, Spinner, WarningIcon } from "./ImportOpenApiDialog";
import {
  SavedResponse,
  activeVariant,
  applyVariant,
  deleteAllResponses,
  endpointKey,
  fetchActive,
  loadResponses,
  normalisePath,
  pushResponse,
  pushResponses,
  sameEndpoint,
  saveResponses,
  warnNotStored,
} from "./storage";

export type EndpointRef = { method: string; endpoint: string };

type Item = EditorTarget & { response?: SavedResponse };
type Group = { id: string; title: string; spec?: SavedResponse["spec"]; items: Item[] };

const itemId = (i: EditorTarget) => `${i.isNew ? "new" : "ep"}:${endpointKey(i)}`;
const specGroupId = (r: SavedResponse) => `spec:${r.spec?.title}:${r.spec?.version}`;

export default function CustomResponsesDialog({
  open,
  onOpenChange,
  webhookId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  /** Endpoint to select when the dialog opens. */
  initial?: EndpointRef | null;
}) {
  const { messages } = useMessages();
  const [saved, setSaved] = useState<SavedResponse[]>([]);
  const [drafts, setDrafts] = useState<EndpointRef[]>([]);
  const [selected, setSelected] = useState<EditorTarget | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  // Keys the server answers with; null until known (or when it can't be reached).
  const [active, setActive] = useState<Set<string> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const editorRef = useRef<ResponseEditorHandle>(null);

  const refreshActive = useCallback(() => {
    fetchActive(webhookId)
      .then(setActive)
      .catch(() => setActive(null));
  }, [webhookId]);

  const reload = useCallback(() => {
    setSaved(loadResponses(webhookId));
    refreshActive();
  }, [webhookId, refreshActive]);

  useEffect(() => {
    if (!open) return;
    setSaved(loadResponses(webhookId));
    setActive(null);
    setRestored(0);
    setDrafts([]);
    setFilter("");
    setSelected(null);
    refreshActive();
  }, [open, webhookId, refreshActive]);

  const savedFor = useCallback((e: EndpointRef) => saved.find((r) => sameEndpoint(r, e)), [saved]);
  // A detected request is covered when a saved template (e.g. /orders/{id}) answers it.
  const coveredBy = useCallback(
    (e: EndpointRef) => saved.find((r) => r.method === e.method && matchesTemplate(r.endpoint, e.endpoint)),
    [saved],
  );

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const r of saved.filter((r) => r.source === "openapi")) {
      const id = specGroupId(r);
      let g = out.find((x) => x.id === id);
      if (!g) out.push((g = { id, title: r.spec?.title ?? "OpenAPI", spec: r.spec, items: [] }));
      g.items.push({ method: r.method, endpoint: r.endpoint, isNew: false, response: r });
    }

    const manual: Item[] = [];
    const add = (e: EndpointRef) => {
      const endpoint = normalisePath(e.endpoint);
      if (manual.some((x) => sameEndpoint(x, e)) || out.some((g) => g.items.some((x) => sameEndpoint(x, e)))) return;
      const response = savedFor(e);
      if (!response && coveredBy({ method: e.method, endpoint })) return;
      manual.push({ method: e.method, endpoint, isNew: false, response });
    };
    saved.filter((r) => !r.source).forEach(add);
    messages.forEach((m) => add({ method: m.method, endpoint: requestPath(m) }));
    if (initial) add(initial);
    drafts.forEach((d) => manual.push({ ...d, isNew: true }));
    if (manual.length) out.push({ id: "manual", title: "Manual", items: manual });
    return out;
  }, [saved, messages, initial, drafts, savedFor, coveredBy]);

  const q = filter.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((i) => `${i.method} ${i.endpoint}`.toLowerCase().includes(q)) }))
        .filter((g) => g.items.length)
    : groups;
  const allItems = groups.flatMap((g) => g.items);

  // Default selection: the requested endpoint (or the template that answers it), else the first one.
  useEffect(() => {
    if (!open || selected || !allItems.length) return;
    const wanted = initial && (coveredBy({ method: initial.method, endpoint: normalisePath(initial.endpoint) }) ?? initial);
    const first = (wanted && allItems.find((i) => sameEndpoint(i, wanted))) ?? allItems[0];
    setSelected({ method: first.method, endpoint: first.endpoint, isNew: first.isNew });
  }, [open, selected, initial, allItems, coveredBy]);

  const current = selected && !selected.isNew ? savedFor(selected) : undefined;
  const isSpec = current?.source === "openapi";
  const inactive = (r: SavedResponse) => active !== null && !active.has(endpointKey(r));
  const missing = active === null ? [] : saved.filter(inactive);

  // Sliding selection indicator, measured from the selected row.
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const selectedId = selected ? itemId(selected) : null;
  useLayoutEffect(() => {
    const el = selectedId ? rowRefs.current.get(selectedId) : undefined;
    setIndicator(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    // groups: rows move when requests arrive or responses change.
  }, [selectedId, groups, filter, open]);

  const addDraft = () => {
    const draft = { method: "POST", endpoint: `/new-endpoint-${drafts.length + 1}` };
    setDrafts((d) => [...d, draft]);
    setSelected({ ...draft, isNew: true });
  };

  const persist = async (next: SavedResponse, message: { title: string; subtitle?: string }) => {
    try {
      await pushResponse(webhookId, next);
      if (!saveResponses(webhookId, loadResponses(webhookId).map((r) => (sameEndpoint(r, next) ? next : r)))) warnNotStored();
      setSaved(loadResponses(webhookId));
      setRevision((n) => n + 1);
      refreshActive();
      notify({ kind: "success", mono: true, ...message });
    } catch (e) {
      notify({ kind: "error", title: "Couldn't update the response", subtitle: e instanceof Error ? e.message : undefined });
    }
  };

  const switchStatus = (r: SavedResponse, code: string) => {
    const variant = r.variants?.find((v) => v.statusCode === code);
    if (!variant || (code === r.statusCode && !r.overridden)) return;
    persist(applyVariant(r, variant), { title: `Now answering ${code}`, subtitle: `${r.method} ${r.endpoint}` });
  };

  const switchExample = (r: SavedResponse, name: string) => {
    const variant = activeVariant(r);
    if (!variant || (name === r.exampleName && !r.overridden)) return;
    persist(applyVariant(r, variant, name), { title: `Example “${name}”`, subtitle: `${r.method} ${r.endpoint}` });
  };

  const resetToSpec = (r: SavedResponse) => {
    const variant = activeVariant(r);
    if (variant) persist(applyVariant(r, variant, r.exampleName), { title: "Reset to the specification", subtitle: `${r.method} ${r.endpoint}` });
  };

  const restoreAll = async () => {
    setRestoring(true);
    try {
      await pushResponses(webhookId, saved);
      setRestored(saved.length);
      refreshActive();
    } catch (e) {
      notify({ kind: "error", title: "Couldn't restore the responses", subtitle: e instanceof Error ? e.message : undefined });
    } finally {
      setRestoring(false);
    }
  };

  const clearAll = async () => {
    try {
      await deleteAllResponses(webhookId);
    } catch {
      /* the local copy is cleared regardless */
    }
    saveResponses(webhookId, []);
    setSaved([]);
    setActive(new Set());
    setSelected(null);
    setConfirmClear(false);
    notify({ title: "All custom responses cleared" });
  };

  const importedCount = saved.filter((r) => r.source === "openapi").length;
  const specTitles = Array.from(new Set(saved.filter((r) => r.spec).map((r) => r.spec!.title)));
  const clearText = [
    importedCount && `${importedCount} imported from ${specTitles.join(", ")}`,
    saved.length - importedCount && `${saved.length - importedCount} set by hand`,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay fixed inset-0 z-50 bg-black/65" />
          <Dialog.Content
            className="modal fixed left-1/2 top-1/2 z-50 flex h-[min(780px,calc(100vh-32px))] w-[min(1120px,calc(100vw-32px))] flex-col bg-layer-1 text-text-primary focus:outline-none"
            style={{ translate: "-50% -50%" }}
          >
            <div className="flex items-end gap-4 pb-4 pl-4 pr-16 pt-4">
              <div className="flex flex-col gap-1">
                <span className="label-01">Webhook {webhookId.slice(0, 8)}</span>
                <Dialog.Title className="m-0 text-xl font-normal leading-7">Custom responses</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Choose what yoohook answers with for each endpoint of this webhook.
                </Dialog.Description>
              </div>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={!saved.length}
                className="btn ml-auto h-8 gap-2 bg-transparent px-3 text-[#ff8389] hover:bg-btn-danger hover:text-white disabled:bg-transparent disabled:text-text-placeholder"
              >
                Clear all
                <Icon name="trash" />
              </button>
              <button type="button" onClick={() => setImportOpen(true)} className="btn btn-ghost h-8 gap-2 px-3 text-link">
                Import OpenAPI
                <Icon name="upload" />
              </button>
            </div>
            <Dialog.Close aria-label="Close" className="btn btn-ghost absolute right-0 top-0 grid h-12 w-12 place-items-center">
              <Icon name="close" size={20} />
            </Dialog.Close>

            {missing.length > 0 && !restored && (
              <div
                role="status"
                className="enter-fade flex min-h-14 items-center gap-3 border-t border-border-subtle bg-layer-2 pl-[13px]"
                style={{ borderLeft: "3px solid #f1c21b" }}
              >
                <WarningIcon />
                <span className="py-2 text-body">
                  <span className="font-semibold">Not active on the server.</span>{" "}
                  {missing.length === saved.length
                    ? `The server restarted and lost its custom responses. ${saved.length === 1 ? "It is" : `All ${saved.length} are`} still saved in this browser.`
                    : `${missing.length} of ${saved.length} responses saved in this browser aren't set on the server.`}
                </span>
                <button
                  type="button"
                  onClick={restoreAll}
                  disabled={restoring}
                  className="btn btn-primary ml-auto gap-3 self-stretch whitespace-nowrap px-4"
                >
                  {restoring && <Spinner track="#ffffff55" color="#ffffff" />}
                  {restoring ? "Restoring…" : "Restore all to server"}
                </button>
              </div>
            )}
            {restored > 0 && (
              <div
                role="status"
                className="enter-fade flex min-h-12 items-center gap-3 border-t border-border-subtle bg-layer-2 pl-[13px] pr-4"
                style={{ borderLeft: "3px solid #24a148" }}
              >
                <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
                  <circle cx="16" cy="16" r="14" fill="#24a148" />
                  <path d="m14 21.59-5-5L10.59 15 14 18.41 21.41 11 23 12.58l-9 9.01z" fill="#ffffff" />
                </svg>
                <span className="text-body">
                  <span className="font-semibold">
                    {restored} {restored === 1 ? "response" : "responses"} restored.
                  </span>{" "}
                  The server answers with them again.
                </span>
              </div>
            )}

            {allItems.length === 0 ? (
              <div className="enter-up flex flex-1 flex-col items-start justify-center gap-4 border-t border-border-subtle p-12">
                <h3 className="m-0 text-[28px] font-light leading-9">No custom responses</h3>
                <p className="m-0 max-w-[560px] text-base leading-6 text-text-secondary">
                  Every request gets the default reply until you set one. Import the vendor's OpenAPI file to mock all its
                  endpoints at once, or add an endpoint by hand.
                </p>
                <div className="mt-2 flex gap-px">
                  <button type="button" onClick={() => setImportOpen(true)} className="btn btn-primary h-12 gap-8 px-4">
                    Import OpenAPI
                    <Icon name="upload" />
                  </button>
                  <button type="button" onClick={addDraft} className="btn btn-secondary h-12 px-4">
                    Add endpoint
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 border-t border-border-subtle">
                <div className="flex w-[380px] shrink-0 flex-col border-r border-border-subtle">
                  <label className="flex h-12 items-center gap-3 border-b border-border-subtle pl-4">
                    <Icon name="search" className="text-text-secondary" />
                    <input
                      aria-label="Filter endpoints"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filter endpoints"
                      className="h-[46px] flex-1 border-0 bg-transparent pr-4 text-text-primary outline-none placeholder:text-text-placeholder"
                    />
                  </label>
                  <div className="relative min-h-0 flex-1 overflow-y-auto">
                    {indicator && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 bg-layer-2 shadow-[inset_3px_0_0_#4589ff] transition-transform duration-240 ease-productive"
                        style={{ height: indicator.height, transform: `translateY(${indicator.top}px)` }}
                      />
                    )}
                    {visibleGroups.length === 0 && <p className="m-0 p-4 text-text-secondary">No endpoints match “{filter}”.</p>}
                    {visibleGroups.map((g) => (
                      <div key={g.id}>
                        {g.spec ? (
                          <div className="relative flex flex-col gap-1 border-b border-border-subtle bg-[#1f1f1f] px-4 py-3">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold">{g.title}</span>
                              <span className="grid h-[18px] shrink-0 place-items-center rounded-full bg-support-info px-2 text-[11px] text-[#d0e2ff]">
                                OpenAPI
                              </span>
                            </span>
                            <span className="font-mono text-label text-text-helper">
                              {[versionLabel(g.spec.version), g.spec.basePath, plural(g.items.length, "op")].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        ) : (
                          groups.length > 1 && (
                            <div className="relative flex h-8 items-center border-b border-border-subtle bg-[#1f1f1f] px-4 text-label text-text-secondary">
                              Manual
                            </div>
                          )
                        )}
                        {g.items.map((item) => {
                          const id = itemId(item);
                          const r = item.response;
                          const off = r && inactive(r);
                          return (
                            <button
                              key={id}
                              ref={(el) => {
                                if (el) rowRefs.current.set(id, el);
                                else rowRefs.current.delete(id);
                              }}
                              type="button"
                              aria-pressed={id === selectedId}
                              onClick={() => setSelected({ method: item.method, endpoint: item.endpoint, isNew: item.isNew })}
                              className="relative flex h-12 w-full items-center gap-3 bg-transparent px-4 text-left transition-colors duration-70 hover:bg-layer-hover1"
                            >
                              <MethodChip method={item.method} />
                              <PathText path={item.endpoint} className="min-w-0 flex-1 truncate text-[12.5px]" />
                              {r?.overridden && (
                                <span title="Edited, differs from the specification" className="h-[6px] w-[6px] shrink-0 rounded-full bg-support-warning" />
                              )}
                              {r && (
                                <span
                                  title={off ? "Not active on the server" : "Custom response set"}
                                  className={cn("enter-fade shrink-0 font-mono text-label", off && "line-through")}
                                  style={{ color: off ? "#6f6f6f" : statusColor(Number(r.statusCode)) }}
                                >
                                  {r.statusCode}
                                </span>
                              )}
                              {item.isNew && <span className="shrink-0 text-label text-text-helper">new</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addDraft}
                    className="btn btn-ghost h-12 justify-between border-t border-solid border-border-subtle px-4 text-link"
                  >
                    Add endpoint
                    <Icon name="add" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 overflow-y-auto">
                  {selected ? (
                    isSpec && current ? (
                      <SpecResponse
                        key={endpointKey(current)}
                        response={current}
                        onStatus={(code) => switchStatus(current, code)}
                        onExample={(name) => switchExample(current, name)}
                        onReset={() => resetToSpec(current)}
                      >
                        <ResponseEditor
                          key={`${revision}:${current.statusCode}:${current.exampleName ?? ""}`}
                          ref={editorRef}
                          target={selected}
                          webhookId={webhookId}
                          saved={current}
                          onBusyChange={setBusy}
                          onSaved={reload}
                          onRemoved={() => {
                            reload();
                            setSelected(null);
                          }}
                        />
                      </SpecResponse>
                    ) : (
                      <ResponseEditor
                        key={`${revision}:${itemId(selected)}`}
                        ref={editorRef}
                        target={selected}
                        webhookId={webhookId}
                        saved={current}
                        onBusyChange={setBusy}
                        onSaved={(r) => {
                          reload();
                          if (selected.isNew) {
                            setDrafts((d) => d.filter((x) => !sameEndpoint(x, selected)));
                            setSelected({ method: r.method, endpoint: r.endpoint, isNew: false });
                          }
                        }}
                        onRemoved={reload}
                      />
                    )
                  ) : (
                    <p className="m-0 p-6 text-text-secondary">Select an endpoint to configure its response.</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid h-16 shrink-0 grid-cols-4">
              <span className="col-span-2 flex items-center border-t border-border-subtle px-4 text-label text-text-secondary">
                Saved in this browser and active in server memory. After a server restart, restore them with one click.
              </span>
              <Dialog.Close className="btn btn-secondary items-start px-4 pb-[30px] pt-[14px] text-left">Close</Dialog.Close>
              <button
                type="button"
                disabled={!selected || busy}
                onClick={() => editorRef.current?.save()}
                className="btn btn-primary items-start px-4 pb-[30px] pt-[14px] text-left"
              >
                {busy ? "Saving…" : current ? "Update response" : "Save response"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ImportOpenApiDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        webhookId={webhookId}
        onImported={() => {
          reload();
          setRestored(0);
          setSelected(null);
          setRevision((n) => n + 1);
        }}
      />

      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        label="Custom responses"
        title="Clear all custom responses?"
        description={
          <>
            This removes all {saved.length} {saved.length === 1 ? "response" : "responses"} for webhook{" "}
            <span className="font-mono">{webhookId.slice(0, 8)}</span>
            {clearText && `: ${clearText}`}. Every request will get the default reply. Your request list stays.
          </>
        }
        primary={{ label: "Clear all", kind: "danger", onClick: clearAll }}
        className="bg-layer-2"
      />
    </>
  );
}

function SpecResponse({
  response: r,
  onStatus,
  onExample,
  onReset,
  children,
}: {
  response: SavedResponse;
  onStatus: (code: string) => void;
  onExample: (name: string) => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const chip = methodChip(r.method);
  const variant = activeVariant(r);
  const names = variant?.examples ? Object.keys(variant.examples) : [];
  const src = variant ? SOURCES[variant.source] : null;

  return (
    <div className="enter-up flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-2">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-6 shrink-0 place-items-center px-[10px] font-mono text-label font-medium"
            style={{ background: chip.bg, color: chip.fg }}
          >
            {r.method}
          </span>
          <PathText path={r.endpoint} className="text-xl leading-7 [overflow-wrap:anywhere]" />
        </span>
        {(r.summary || r.operationId) && (
          <span className="text-text-secondary">
            {r.summary} {r.operationId && <span className="font-mono text-[#8d8d8d]">· operationId {r.operationId}</span>}
          </span>
        )}
        <span className="text-label text-text-helper">{paramText(r.endpoint)}</span>
      </div>

      {r.variants && r.variants.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label-01">Respond with</span>
          <div role="radiogroup" aria-label="Response status" className="flex flex-wrap self-start border border-solid border-border-strong">
            {r.variants.map((v) => {
              const on = v.statusCode === r.statusCode;
              const code = Number(v.statusCode);
              return (
                <button
                  key={v.statusCode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onStatus(v.statusCode)}
                  className={cn(
                    "flex h-10 min-w-[140px] items-center gap-2 px-4 text-left text-compact transition-colors duration-110 ease-productive",
                    !on && "hover:bg-layer-hover1",
                  )}
                  style={{ background: on ? "#f4f4f4" : "transparent", color: on ? "#161616" : "#c6c6c6" }}
                >
                  <span className="font-mono" style={{ color: on ? "#161616" : statusColor(code) }}>
                    {v.statusCode}
                  </span>
                  {reasonPhrase(code)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {names.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="label-01">Example from the specification</span>
          <ExampleChips names={names} value={r.exampleName} onChange={onExample} />
        </div>
      )}

      {r.overridden ? (
        <div role="status" className="enter-fade flex items-center gap-3 bg-layer-2 py-1 pl-[13px]" style={{ borderLeft: "3px solid #f1c21b" }}>
          <WarningIcon />
          <span className="text-body">
            <span className="font-semibold">Edited.</span> This response no longer matches the specification.
          </span>
          <button type="button" onClick={onReset} className="btn btn-ghost ml-auto h-10 whitespace-nowrap px-4 text-link">
            Reset to spec
          </button>
        </div>
      ) : (
        src && (
          <span className="flex items-center gap-2 text-label" style={{ color: src.color }}>
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: src.color }} />
            {src.title}
          </span>
        )
      )}

      {children}
    </div>
  );
}
