import { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

const MIN = 280;
const MAX = 640;
const DEFAULT = 400;
const STORAGE_KEY = "requestListWidth";

const clamp = (w: number) => Math.max(MIN, Math.min(MAX, Math.round(w)));

function readWidth() {
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(saved) && saved > 0 ? clamp(saved) : DEFAULT;
}

/** Left pane with a draggable, keyboard-accessible splitter; width is remembered. */
export default function ResizableSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [width, setWidth] = useState(readWidth);
  const [dragging, setDragging] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  useEffect(() => () => stopRef.current?.(), []);

  const startDrag = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const move = (ev: PointerEvent) => setWidth(clamp(startW + ev.clientX - startX));
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        stopRef.current = null;
        setDragging(false);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      stopRef.current = stop;
      setDragging(true);
    },
    [width],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    const next =
      e.key === "ArrowLeft"
        ? width - step
        : e.key === "ArrowRight"
          ? width + step
          : e.key === "Home"
            ? MIN
            : e.key === "End"
              ? MAX
              : null;
    if (next === null) return;
    e.preventDefault();
    setWidth(clamp(next));
  };

  return (
    <div
      className="flex min-h-0 flex-1"
      style={{ userSelect: dragging ? "none" : undefined, cursor: dragging ? "col-resize" : undefined }}
    >
      <div className="min-h-0 min-w-0 shrink-0" style={{ width }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize request list"
        aria-valuenow={width}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setWidth(DEFAULT)}
        data-dragging={dragging}
        className="resize-handle relative z-[3] w-px shrink-0 cursor-col-resize bg-layer-2 transition-colors duration-110 ease-productive"
      >
        <span className="resize-grip absolute left-1/2 top-1/2 h-8 w-1 bg-border-interactive opacity-0 transition-[opacity,transform] duration-240 ease-productive [transform:translate(-50%,-50%)_scaleY(0.4)]" />
        {dragging && (
          <span className="tip-in pointer-events-none absolute left-3 top-3 whitespace-nowrap bg-inverse px-2 py-1 font-mono text-label text-text-inverse">
            {width} px
          </span>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{right}</div>
    </div>
  );
}
