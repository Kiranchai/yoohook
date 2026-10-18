import * as Dialog from "@radix-ui/react-dialog";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { hookUrl, methodChip, reasonPhrase, statusColor } from "@/lib/http";
import { bodyLines } from "@/lib/body";
import {
  ParsedSpec,
  SOURCES,
  SpecOperation,
  SpecVariant,
  VariantSource,
  defaultVariant,
  paramText,
  parseSpec,
  pathParts,
  plural,
  versionLabel,
} from "@/lib/openapi";
import { notify } from "@/lib/notify";
import { Icon } from "@/components/icons";
import { CodeBlock, Toggle } from "@/components/common";
import { SavedResponse, applyVariant, endpointKey, loadResponses, normalisePath, pushResponses, saveResponses, warnNotStored } from "./storage";

const MAX_FILE = 10 * 1024 * 1024;
const STEPS = ["Source", "Choose operations", "Done"];

export function PathText({ path, className }: { path: string; className?: string }) {
  return (
    <span className={cn("font-mono", className)}>
      {pathParts(path).map((p, i) => (
        <span key={i} style={{ color: p.param ? "#f1c21b" : undefined }}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

export function Spinner({ track = "#393939", color = "#4589ff" }: { track?: string; color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={track} strokeWidth="1.5" />
      <circle className="spin" cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="40.8" strokeDashoffset="28" />
    </svg>
  );
}

export function StatusChips({
  variants,
  value,
  onChange,
  label,
}: {
  variants: SpecVariant[];
  value: string;
  onChange: (code: string) => void;
  label: string;
}) {
  return (
    <span role="radiogroup" aria-label={label} className="flex flex-wrap justify-end gap-1">
      {variants.map((v) => {
        const on = v.statusCode === value;
        return (
          <button
            key={v.statusCode}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v.statusCode)}
            className={cn("h-5 rounded-full px-[6px] font-mono text-[11px] transition-colors duration-70", !on && "hover:bg-layer-active")}
            style={{ background: on ? "#f4f4f4" : "#393939", color: on ? "#161616" : statusColor(Number(v.statusCode)) }}
          >
            {v.statusCode}
          </button>
        );
      })}
    </span>
  );
}

export function ExampleChips({ names, value, onChange }: { names: string[]; value?: string; onChange: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((name) => {
        const on = name === value;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(name)}
            className={cn("h-6 rounded-full px-[10px] text-label transition-colors duration-70", !on && "hover:bg-layer-active")}
            style={{ background: on ? "#f4f4f4" : "#393939", color: on ? "#161616" : "#f4f4f4" }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center border border-solid p-0 transition-colors duration-70"
      style={{ borderColor: checked ? "#f4f4f4" : "#8d8d8d", background: checked ? "#f4f4f4" : "transparent" }}
    >
      {checked && <Icon name="checkmark" size={12} style={{ color: "#161616" }} />}
    </button>
  );
}

type Choice = { status: string; example?: string };

export default function ImportOpenApiDialog({
  open,
  onOpenChange,
  webhookId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  onImported: () => void;
}) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [spec, setSpec] = useState<ParsedSpec | null>(null);
  const [prefixOn, setPrefixOn] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SavedResponse[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFileName("");
    setError("");
    setSpec(null);
    setFilter("");
    setResult([]);
  }, [open]);

  const prefix = spec && prefixOn ? spec.basePath : "";
  const endpointOf = (op: SpecOperation) => normalisePath(prefix + op.path);

  // Manual responses already set for this webhook; they win over the import.
  const manualKeys = useMemo(() => {
    if (!open) return new Set<string>();
    return new Set(loadResponses(webhookId).filter((r) => !r.source).map(endpointKey));
  }, [open, webhookId]);
  const hasManual = (op: SpecOperation) => manualKeys.has(endpointKey({ method: op.method, endpoint: endpointOf(op) }));

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE) return setError(`${file.name} is larger than 10 MB.`);
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = parseSpec(await file.text());
      setSpec(parsed);
      setPrefixOn(true);
      setSelected(new Set(parsed.operations.map((o) => o.key)));
      setChoices(Object.fromEntries(parsed.operations.map((o) => [o.key, { status: defaultVariant(o).statusCode }])));
      setFocus(parsed.operations[0].key);
      setFilter("");
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file couldn't be read.");
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files[0]);
  };

  const ops = spec?.operations ?? [];
  const q = filter.trim().toLowerCase();
  const visible = q
    ? ops.filter((o) => [o.path, o.id, o.tag, o.summary, o.method].some((s) => s.toLowerCase().includes(q)))
    : ops;
  const groups = (spec?.tags ?? []).map((tag) => ({ tag, ops: visible.filter((o) => o.tag === tag) })).filter((g) => g.ops.length);
  const importable = ops.filter((o) => selected.has(o.key) && !hasManual(o));
  const allSelected = visible.length > 0 && visible.every((o) => selected.has(o.key));

  const variantOf = (op: SpecOperation) => op.responses.find((r) => r.statusCode === choices[op.key]?.status) ?? defaultVariant(op);
  const focused = ops.find((o) => o.key === focus) ?? ops[0];

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      visible.forEach((o) => (allSelected ? next.delete(o.key) : next.add(o.key)));
      return next;
    });

  const choose = (op: SpecOperation, choice: Partial<Choice>) => {
    setChoices((c) => ({ ...c, [op.key]: { ...c[op.key], ...choice } }));
    setFocus(op.key);
  };

  const runImport = async () => {
    if (!spec || !importable.length) return;
    setError("");
    setImporting(true);
    const imported = importable.map((op) =>
      applyVariant(
        {
          method: op.method,
          endpoint: endpointOf(op),
          statusCode: "",
          headers: {},
          body: "",
          bodyFormat: "json",
          source: "openapi",
          spec: { title: spec.title, version: spec.version, basePath: prefix },
          operationId: op.id,
          summary: op.summary,
          tag: op.tag,
          variants: op.responses,
        },
        variantOf(op),
        choices[op.key]?.example,
      ),
    );
    try {
      await pushResponses(webhookId, imported);
      const keys = new Set(imported.map(endpointKey));
      const stored = saveResponses(webhookId, [...loadResponses(webhookId).filter((r) => !keys.has(endpointKey(r))), ...imported]);
      if (!stored) warnNotStored();
      setResult(imported);
      setStep(2);
      onImported();
      notify({ kind: "success", title: `${imported.length} responses imported`, subtitle: spec.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The server couldn't be reached.");
    } finally {
      setImporting(false);
    }
  };

  const stats = {
    example: result.filter((r) => ["example", "examples"].includes(activeSource(r))).length,
    generated: result.filter((r) => activeSource(r) === "generated").length,
    empty: result.filter((r) => activeSource(r) === "empty").length,
  };

  const footNote =
    step === 0
      ? "Nothing is changed until the last step."
      : step === 1
        ? `${selected.size} of ${ops.length} selected · existing manual responses are kept`
        : "";

  const back = () => {
    setError("");
    if (step === 1) setStep(0);
    else onOpenChange(false);
  };
  const next = () => {
    if (step === 0 && spec) setStep(1);
    else if (step === 1) runImport();
    else onOpenChange(false);
  };
  const nextDisabled = (step === 0 && !spec) || (step === 1 && (!importable.length || importing));
  const nextLabel =
    step === 0 ? "Next" : step === 1 ? (importing ? "Importing…" : `Import ${importable.length} operations`) : "Open custom responses";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content
          className="modal fixed left-1/2 top-1/2 z-50 flex h-[min(780px,calc(100vh-32px))] w-[min(1120px,calc(100vw-32px))] flex-col bg-layer-1 text-text-primary focus:outline-none"
          style={{ translate: "-50% -50%" }}
        >
          <div className="pl-4 pr-16 pt-4">
            <span className="label-01">Custom responses</span>
            <Dialog.Title className="mt-1 text-xl font-normal leading-7">Import OpenAPI specification</Dialog.Title>
            <Dialog.Description className="sr-only">
              Turn the responses of a vendor's OpenAPI file into custom responses for this webhook.
            </Dialog.Description>
          </div>
          <Dialog.Close aria-label="Close" className="btn btn-ghost absolute right-0 top-0 grid h-12 w-12 place-items-center">
            <Icon name="close" size={20} />
          </Dialog.Close>

          <ol aria-label="Import steps" className="m-0 mt-4 grid list-none grid-cols-3 gap-4 px-4">
            {STEPS.map((label, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className="flex items-center gap-2 border-t-2 border-solid pt-2 text-compact transition-colors duration-240 ease-productive"
                  style={{ borderColor: done || current ? "#4589ff" : "#525252", color: current ? "#f4f4f4" : done ? "#c6c6c6" : "#8d8d8d" }}
                >
                  <span
                    className="grid h-4 w-4 place-items-center rounded-full border border-solid"
                    style={{ borderColor: done ? "#4589ff" : current ? "#f4f4f4" : "#6f6f6f", background: done ? "#4589ff" : "transparent" }}
                  >
                    {done && <Icon name="checkmark" size={10} style={{ color: "#161616" }} />}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-border-subtle">
            {step === 0 && (
              <div key="source" className="step-in flex max-w-[760px] flex-1 flex-col gap-2 px-4 py-8">
                <span className="text-compact font-semibold">Upload the specification</span>
                <span className="text-body text-text-secondary">The vendor's OpenAPI file as JSON or YAML.</span>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className="mt-2 flex h-[280px] flex-col items-center justify-center gap-3 border border-dashed bg-transparent text-text-primary transition-colors duration-110 hover:border-border-field hover:bg-layer-hover1"
                  style={{ borderColor: dragging ? "#4589ff" : undefined, background: dragging ? "#333333" : undefined }}
                >
                  <Icon name="upload" size={32} className="text-text-secondary" />
                  <span>
                    Drag a file here or <span className="text-link">browse</span>
                  </span>
                  <span className="font-mono text-label text-text-helper">.json · .yaml · .yml — up to 10 MB</span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,.yaml,.yml,application/json,application/yaml"
                  className="hidden"
                  onChange={(e) => {
                    readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {parsing && (
                  <div className="mt-2 flex items-center gap-2 text-text-secondary">
                    <Spinner />
                    Reading {fileName}…
                  </div>
                )}
                {error && (
                  <div role="alert" className="mt-2 bg-layer-2 py-3 pl-[13px] pr-4 text-compact" style={{ borderLeft: "3px solid #fa4d56" }}>
                    <span className="font-semibold">{fileName ? `${fileName} couldn't be imported.` : "The file couldn't be imported."}</span>{" "}
                    {error}
                  </div>
                )}
              </div>
            )}

            {step === 1 && spec && (
              <div key="select" className="step-in flex min-h-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border-subtle bg-[#1f1f1f] px-4 py-3">
                  <span className="flex flex-col gap-[2px]">
                    <span className="font-semibold">{spec.title}</span>
                    <span className="font-mono text-label text-text-helper">
                      {[versionLabel(spec.version), spec.format, plural(ops.length, "operation"), plural(spec.tags.length, "tag")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {spec.basePath && (
                    <span className="ml-auto flex items-center gap-1">
                      <Toggle checked={prefixOn} onChange={setPrefixOn} label={`Prefix paths with ${spec.basePath}`} />
                      <span className="font-mono text-label text-text-helper">{spec.format.startsWith("Swagger") ? "from basePath" : "from servers[0]"}</span>
                    </span>
                  )}
                </div>
                <div className="flex min-h-0 flex-1">
                  <div className="flex min-w-0 flex-[1_1_60%] flex-col border-r border-border-subtle">
                    <div className="flex h-12 items-center border-b border-border-subtle">
                      <label className="flex flex-1 items-center gap-3 pl-4">
                        <Icon name="search" className="text-text-secondary" />
                        <input
                          aria-label="Filter operations"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="Filter by path, operationId or tag"
                          className="h-[46px] flex-1 border-0 bg-transparent text-text-primary outline-none placeholder:text-text-placeholder"
                        />
                      </label>
                      <button type="button" onClick={toggleAll} className="btn btn-ghost h-12 px-4 text-link">
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {groups.length === 0 && <p className="m-0 p-4 text-text-secondary">No operations match “{filter}”.</p>}
                      {groups.map((g) => (
                        <div key={g.tag}>
                          <div className="sticky top-0 z-[1] flex h-8 items-center gap-2 bg-layer-2 px-4 text-label">
                            <span className="font-semibold">{g.tag}</span>
                            <span className="font-mono text-text-secondary">{g.ops.length}</span>
                          </div>
                          {g.ops.map((op) => {
                            const on = selected.has(op.key);
                            const variant = variantOf(op);
                            const src = SOURCES[variant.source];
                            const chip = methodChip(op.method);
                            const isFocused = focused?.key === op.key;
                            return (
                              <div key={op.key}>
                                <div
                                  className="relative flex items-start gap-3 border-b border-border-subtle px-4 py-3 transition-colors duration-70 hover:bg-layer-hover1"
                                  style={{
                                    background: isFocused ? "#333333" : undefined,
                                    boxShadow: isFocused ? "inset 3px 0 0 #4589ff" : undefined,
                                  }}
                                >
                                  <Checkbox checked={on} onChange={() => toggle(op.key)} label={`Import ${op.method} ${op.path}`} />
                                  <button
                                    type="button"
                                    onClick={() => setFocus(op.key)}
                                    className="flex min-w-0 flex-1 flex-col gap-[6px] bg-transparent p-0 text-left transition-opacity duration-110"
                                    style={{ opacity: on ? 1 : 0.5 }}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      <span
                                        className="grid h-5 w-16 shrink-0 place-items-center font-mono text-[11px] font-medium tracking-[0.5px]"
                                        style={{ background: chip.bg, color: chip.fg }}
                                      >
                                        {op.method}
                                      </span>
                                      <span className="min-w-0 truncate font-mono text-[13px]">
                                        <span className="text-text-helper">{prefix}</span>
                                        <PathText path={op.path} />
                                      </span>
                                    </span>
                                    <span className="pl-[76px] text-label text-text-secondary">
                                      {op.summary && `${op.summary} · `}
                                      <span className="font-mono text-[#8d8d8d]">{op.id}</span>
                                    </span>
                                  </button>
                                  <span className="flex shrink-0 flex-col items-end gap-[6px]">
                                    <StatusChips
                                      variants={op.responses}
                                      value={variant.statusCode}
                                      onChange={(status) => choose(op, { status, example: undefined })}
                                      label={`Default response for ${op.id}`}
                                    />
                                    <span className="flex items-center gap-[6px] text-[11px]" style={{ color: src.color }}>
                                      <span className="h-[6px] w-[6px] rounded-full" style={{ background: src.color }} />
                                      {src.label}
                                    </span>
                                  </span>
                                </div>
                                {on && hasManual(op) && (
                                  <div className="flex items-center gap-2 border-b border-border-subtle bg-[#2b2a1f] py-2 pl-[104px] pr-4 text-label">
                                    <WarningIcon size={14} />
                                    You already set a manual response here. It stays and wins over the import.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {focused && <Preview key={focused.key} op={focused} prefix={prefix} variant={variantOf(focused)} example={choices[focused.key]?.example} onExample={(example) => choose(focused, { example })} />}
                </div>
              </div>
            )}

            {step === 2 && (
              <div key="done" className="step-in flex max-w-[760px] flex-1 flex-col gap-6 px-8 py-12">
                <span className="check-in grid h-12 w-12 place-items-center rounded-full bg-support-success">
                  <Icon name="checkmark" size={28} style={{ color: "#ffffff" }} />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-[28px] font-light leading-9">
                    {result.length} {result.length === 1 ? "operation" : "operations"} ready to answer
                  </h3>
                  <p className="m-0 text-base leading-6 text-text-secondary">
                    Point to <span className="font-mono text-text-primary [overflow-wrap:anywhere]">{hookUrl(webhookId)}{prefix}</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-px bg-layer-2">
                  {[
                    [stats.example, "from vendor examples", "#42be65"],
                    [stats.generated, "generated from schemas", "#be95ff"],
                    [stats.empty, "without a body", "#c6c6c6"],
                  ].map(([n, label, color]) => (
                    <div key={label} className="flex flex-col gap-1 bg-[#1f1f1f] p-4">
                      <span className="font-mono text-[28px] leading-9" style={{ color: String(color) }}>
                        {n}
                      </span>
                      <span className="text-text-secondary">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {step === 1 && error && (
            <div role="alert" className="bg-layer-2 py-3 pl-[13px] pr-4 text-compact" style={{ borderLeft: "3px solid #fa4d56" }}>
              <span className="font-semibold">Import failed.</span> {error}
            </div>
          )}

          <div className="grid h-16 shrink-0 grid-cols-4">
            <span className="col-span-2 flex items-center border-t border-border-subtle px-4 text-label text-text-secondary">{footNote}</span>
            <button type="button" onClick={back} className="btn btn-secondary items-start px-4 pb-[30px] pt-[14px] text-left">
              {step === 0 ? "Cancel" : step === 1 ? "Back" : "Close"}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={nextDisabled}
              className="btn btn-primary items-start px-4 pb-[30px] pt-[14px] text-left"
            >
              {nextLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function activeSource(r: SavedResponse): VariantSource {
  return r.variants?.find((v) => v.statusCode === r.statusCode)?.source ?? "empty";
}

export function WarningIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M16 2 1 29h30z" fill="#f1c21b" />
      <path d="M15 12h2v8h-2zM16 22a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 22z" fill="#161616" />
    </svg>
  );
}

function Preview({
  op,
  prefix,
  variant,
  example,
  onExample,
}: {
  op: SpecOperation;
  prefix: string;
  variant: SpecVariant;
  example?: string;
  onExample: (name: string) => void;
}) {
  const src = SOURCES[variant.source];
  const names = variant.examples ? Object.keys(variant.examples) : [];
  const exampleName = example && names.includes(example) ? example : names[0];
  const body = exampleName ? variant.examples![exampleName] : variant.body;
  const code = Number(variant.statusCode);
  const contentType = variant.headers["Content-Type"] ?? (variant.bodyFormat === "json" ? "application/json" : variant.bodyFormat);

  return (
    <div className="min-w-0 flex-[1_1_40%] overflow-y-auto bg-[#1f1f1f]">
      <div className="enter-fade flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="label-01">Preview · what yoohook will answer</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xl leading-7" style={{ color: statusColor(code) }}>
              {variant.statusCode}
            </span>
            <span className="text-text-secondary">{reasonPhrase(code)}</span>
          </span>
          <span className="font-mono text-label text-text-helper [overflow-wrap:anywhere]">
            {op.method} {prefix}
            {op.path}
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-layer-1 p-3" style={{ borderLeft: `3px solid ${src.color}` }}>
          <span className="font-semibold">{src.title}</span>
          <span className="text-label text-text-secondary">{src.text}</span>
        </div>
        {names.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="label-01">Named examples</span>
            <ExampleChips names={names} value={exampleName} onChange={onExample} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="label-01">Body{variant.source !== "empty" && ` · ${contentType}`}</span>
          {variant.source === "empty" ? (
            <p className="m-0 bg-background p-4 text-text-secondary">No body for this response.</p>
          ) : (
            <CodeBlock lines={bodyLines(body, variant.bodyFormat)} className="bg-background py-3 text-[12.5px] leading-[19px]" />
          )}
        </div>
        {Object.keys(variant.headers).length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="label-01">Headers</span>
            <div className="font-mono text-[12.5px]">
              {Object.entries(variant.headers).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[180px_1fr] gap-2 border-b border-border-subtle bg-layer-1 px-4 py-[10px]">
                  <span className="text-text-secondary [overflow-wrap:anywhere]">{k}</span>
                  <span className="[overflow-wrap:anywhere]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="label-01">Path parameters</span>
          <span className="text-body text-text-secondary">{paramText(op.path)}</span>
        </div>
      </div>
    </div>
  );
}
