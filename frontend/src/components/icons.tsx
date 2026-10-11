import { SVGProps } from "react";

// Carbon-style 32×32 glyphs, inlined so we don't ship a whole icon package.
const PATHS = {
  copy: "M28 10v18H10V10h18m0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM4 18H2V4a2 2 0 0 1 2-2h14v2H4z",
  checkmark: "m13 24-9-9 1.41-1.41L13 21.17 26.59 7.58 28 9 13 24z",
  edit: "M2 26h28v2H2zM25.4 9a2 2 0 0 0 0-2.83l-3.6-3.6a2 2 0 0 0-2.83 0l-15 15V24h6.4zm-5-5L24 7.6l-3 3L17.4 7zM6 22v-3.6l10-10 3.6 3.6-10 10z",
  renew: "M12 10H6.78A11 11 0 0 1 27 16h2A13 13 0 0 0 6 7.68V4H4v8h8zM20 22h5.22A11 11 0 0 1 5 16H3a13 13 0 0 0 23 8.32V28h2v-8h-8z",
  settings:
    "M30 8h-4.1a5 5 0 0 0-9.8 0H2v2h14.1a5 5 0 0 0 9.8 0H30zm-9 4a3 3 0 1 1 3-3 3 3 0 0 1-3 3zM2 24h4.1a5 5 0 0 0 9.8 0H30v-2H15.9a5 5 0 0 0-9.8 0H2zm9-4a3 3 0 1 1-3 3 3 3 0 0 1 3-3z",
  close:
    "M24 9.4 22.6 8 16 14.6 9.4 8 8 9.4l6.6 6.6L8 22.6 9.4 24l6.6-6.6 6.6 6.6 1.4-1.4-6.6-6.6L24 9.4z",
  trash: "M12 12h2v12h-2zM18 12h2v12h-2zM4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20zM12 2h8v2h-8z",
  chevronDown: "M16 22 6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z",
  arrowRight: "m18 6-1.43 1.39L24.15 15H4v2h20.15l-7.58 7.57L18 26l10-10L18 6z",
  add: "M17 15V8h-2v7H8v2h7v7h2v-7h7v-2z",
  search:
    "m29 27.59-7.55-7.56a11 11 0 1 0-1.41 1.41L27.59 29zM4 13a9 9 0 1 1 9 9 9 9 0 0 1-9-9z",
  download: "M26 15l-1.41-1.41L17 21.17V2h-2v19.17l-7.59-7.58L6 15l10 10 10-10zM26 24v4H6v-4H4v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4z",
  code: "M31 16l-7 7-1.41-1.41L28.17 16l-5.58-5.59L24 9l7 7zM1 16l7-7 1.41 1.41L3.83 16l5.58 5.59L8 23l-7-7zM12.42 25.95l5.21-19.9 1.94.5-5.21 19.9z",
  link: "M29.25 6.76a6 6 0 0 0-8.5 0l1.42 1.42a4 4 0 1 1 5.67 5.67l-8 8a4 4 0 1 1-5.67-5.66l1.41-1.42-1.41-1.42-1.42 1.42a6 6 0 0 0 0 8.5A6 6 0 0 0 17 25a6 6 0 0 0 4.27-1.76l8-8a6 6 0 0 0-.02-8.48zM4.19 24.82a4 4 0 0 1 0-5.67l8-8a4 4 0 0 1 5.67 0A3.94 3.94 0 0 1 19 14a4 4 0 0 1-1.17 2.85L15.71 19l1.42 1.42 2.12-2.12a6 6 0 0 0-8.51-8.51l-8 8a6 6 0 0 0 0 8.51A6 6 0 0 0 7 28a6.07 6.07 0 0 0 4.28-1.76l-1.42-1.42a4 4 0 0 1-5.67 0z",
  image:
    "M19 14a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0-4a1 1 0 1 1-1 1 1 1 0 0 1 1-1zM26 4H6a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 22H6v-6l5-5 5.59 5.59a2 2 0 0 0 2.82 0L21 19l5 5zm0-4.83-3.59-3.59a2 2 0 0 0-2.82 0L18 19.17l-5.59-5.59a2 2 0 0 0-2.82 0L6 17.17V6h20z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Filled Carbon notification glyphs (circle + symbol). */
export function StatusIcon({ kind, size = 20 }: { kind: "info" | "success" | "error" | "warning"; size?: number }) {
  if (kind === "warning") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <path d="M16 2 1 29h30z" fill="#f1c21b" />
        <path d="M15 12h2v8h-2zM16 22a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 22z" fill="#161616" />
      </svg>
    );
  }
  const fill = { info: "#0043ce", success: "#24a148", error: "#fa4d56" }[kind];
  const glyph = {
    info: "M17 22v-8h-4v2h2v6h-3v2h8v-2h-3zM16 8a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 16 8z",
    success: "m14 21.59-5-5L10.59 15 14 18.41 21.41 11 23 12.58l-9 9.01z",
    error: "M21.4 23 16 17.6 10.6 23 9 21.4l5.4-5.4L9 10.6 10.6 9l5.4 5.4L21.4 9l1.6 1.6-5.4 5.4 5.4 5.4z",
  }[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="14" fill={fill} />
      <path d={glyph} fill={kind === "error" ? "#161616" : "#ffffff"} />
    </svg>
  );
}

export function InlineSpinner({ size = 16, color = "#4589ff", track = true }: { size?: number; color?: string; track?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {track && <circle cx="8" cy="8" r="6.5" fill="none" stroke="#393939" strokeWidth="1.5" />}
      <circle className="spin" cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="40.8" strokeDashoffset="28" />
    </svg>
  );
}
