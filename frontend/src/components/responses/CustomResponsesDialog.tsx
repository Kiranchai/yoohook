import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "@/providers/MessagesProvider";
import { SERVER_URL, requestPath } from "@/lib/http";
import { notify } from "@/lib/notify";
import { Icon } from "@/components/icons";
import { MethodChip } from "@/components/common";
import ResponseEditor, { EditorTarget, ResponseEditorHandle } from "./ResponseEditor";
import { SavedResponse, loadResponses, sameEndpoint, saveResponses } from "./storage";

const ROW_HEIGHT = 48;

export type EndpointRef = { method: string; endpoint: string };

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
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<ResponseEditorHandle>(null);

  const endpoints = useMemo(() => {
    const list: EndpointRef[] = [];
    const add = (e: EndpointRef) => {
      if (!list.some((x) => sameEndpoint(x, e))) list.push(e);
    };
    messages.forEach((m) => add({ method: m.method, endpoint: requestPath(m) }));
    saved.forEach((r) => add({ method: r.method, endpoint: r.endpoint }));
    if (initial) add(initial);
    return list;
  }, [messages, saved, initial]);

  useEffect(() => {
    if (!open) return;
    setSaved(loadResponses());
    setDrafts([]);
    setSelected(null);
  }, [open]);

  // Default selection: the requested endpoint, else the first one.
  useEffect(() => {
    if (!open || selected) return;
    const first = initial ?? endpoints[0];
    if (first) setSelected({ ...first, isNew: false });
  }, [open, selected, initial, endpoints]);

  const items = [...endpoints.map((e) => ({ ...e, isNew: false })), ...drafts.map((d) => ({ ...d, isNew: true }))];
  const selectedIndex = selected ? items.findIndex((i) => sameEndpoint(i, selected) && i.isNew === selected.isNew) : -1;
  const savedFor = (e: EndpointRef) => saved.find((r) => sameEndpoint(r, e));
  const current = selected ? savedFor(selected) : undefined;

  const addDraft = () => {
    const draft = { method: "POST", endpoint: `/new-endpoint-${drafts.length + 1}` };
    setDrafts((d) => [...d, draft]);
    setSelected({ ...draft, isNew: true });
  };

  const clearAll = async () => {
    try {
      await fetch(`${SERVER_URL}/delete-responses/${webhookId}`, { method: "DELETE" });
    } catch {
      /* local copy is cleared regardless */
    }
    saveResponses([]);
    setSaved([]);
    notify({ title: "All custom responses cleared" });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content
          className="modal fixed left-1/2 top-1/2 z-50 flex h-[min(720px,calc(100vh-32px))] w-[min(1040px,calc(100vw-32px))] flex-col bg-layer-1 text-text-primary focus:outline-none"
          style={{ translate: "-50% -50%" }}
        >
          <div className="pb-4 pl-4 pr-16 pt-4">
            <span className="label-01">Webhook {webhookId.slice(0, 8)}</span>
            <Dialog.Title className="mt-1 text-xl font-normal leading-7">Custom responses</Dialog.Title>
            <Dialog.Description className="sr-only">
              Choose what yoohook answers with for each endpoint of this webhook.
            </Dialog.Description>
          </div>
          <Dialog.Close aria-label="Close" className="btn btn-ghost absolute right-0 top-0 h-12 w-12 justify-center">
            <Icon name="close" size={20} />
          </Dialog.Close>

          <div className="flex min-h-0 flex-1 border-t border-border-subtle">
            <div className="flex w-80 shrink-0 flex-col border-r border-border-subtle">
              <div className="flex h-10 items-center justify-between border-b border-border-subtle pl-4">
                <span className="text-compact font-semibold">Endpoints</span>
                {saved.length > 0 ? (
                  <button type="button" onClick={clearAll} className="btn btn-ghost h-10 px-4 text-label text-link">
                    Clear all responses
                  </button>
                ) : (
                  <span className="px-4 font-mono text-label text-text-helper">{items.length}</span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 && (
                  <p className="m-0 p-4 text-text-secondary">
                    No requests yet. Add an endpoint to prepare a response in advance.
                  </p>
                )}
                <div className="relative">
                  {selectedIndex >= 0 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 bg-layer-2 shadow-[inset_3px_0_0_#4589ff] transition-transform duration-240 ease-productive"
                      style={{ height: ROW_HEIGHT, transform: `translateY(${selectedIndex * ROW_HEIGHT}px)` }}
                    />
                  )}
                  {items.map((item, i) => {
                    const response = item.isNew ? undefined : savedFor(item);
                    return (
                      <button
                        key={`${item.isNew ? "new" : "ep"}:${item.method}:${item.endpoint}:${i}`}
                        type="button"
                        aria-pressed={i === selectedIndex}
                        onClick={() => setSelected(item)}
                        className="relative flex h-12 w-full items-center gap-3 bg-transparent px-4 text-left transition-colors duration-70 hover:bg-layer-hover1"
                      >
                        <MethodChip method={item.method} />
                        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{item.endpoint}</span>
                        {response && (
                          <span title="Custom response set" className="enter-fade shrink-0 font-mono text-label text-[#42be65]">
                            {response.statusCode}
                          </span>
                        )}
                        {item.isNew && <span className="shrink-0 text-label text-text-helper">new</span>}
                      </button>
                    );
                  })}
                </div>
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
                <ResponseEditor
                  key={`${selected.isNew}:${selected.method}:${selected.endpoint}`}
                  ref={editorRef}
                  target={selected}
                  webhookId={webhookId}
                  saved={current}
                  onBusyChange={setBusy}
                  onSaved={(r) => {
                    setSaved(loadResponses());
                    if (selected.isNew) {
                      setDrafts((d) => d.filter((x) => !sameEndpoint(x, selected)));
                      setSelected({ method: r.method, endpoint: r.endpoint, isNew: false });
                    }
                  }}
                  onRemoved={() => setSaved(loadResponses())}
                />
              ) : (
                <p className="m-0 p-6 text-text-secondary">Select an endpoint to configure its response.</p>
              )}
            </div>
          </div>

          <div className="grid h-16 shrink-0 grid-cols-4">
            <span className="col-span-2 border-t border-border-subtle" />
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
  );
}
