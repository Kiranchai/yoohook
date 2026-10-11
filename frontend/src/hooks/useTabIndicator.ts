import { useEffect } from "react";
import { ConnectionStatus } from "@/hooks/useWebSocket";

const BASE_TITLE = "yoohook · Inspector";
const FAVICON = "/favicon.ico";

let baseIcon: Promise<HTMLImageElement> | null = null;

const loadBaseIcon = () =>
  (baseIcon ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = FAVICON;
  }));

/** The regular favicon with a coloured square in its top-right corner. */
async function drawBadgedFavicon(badge: string) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(await loadBaseIcon(), 0, 0, size, size);
  ctx.fillStyle = "#161616";
  ctx.fillRect(size - 30, 0, 30, 30);
  ctx.fillStyle = badge;
  ctx.fillRect(size - 26, 0, 26, 26);
  return canvas.toDataURL("image/png");
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = href.startsWith("data:") ? "image/png" : "image/x-icon";
  link.href = href;
}

/** Unread count in the tab title, plus a blue/red corner on the favicon. */
export function useTabIndicator(unreadCount: number, status: ConnectionStatus) {
  useEffect(() => {
    if (status === "disconnected") document.title = `Offline · ${BASE_TITLE}`;
    else document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;

    const badge = status === "disconnected" ? "#da1e28" : unreadCount > 0 ? "#0f62fe" : null;
    if (!badge) {
      setFavicon(FAVICON);
      return;
    }

    let cancelled = false;
    drawBadgedFavicon(badge)
      .then((icon) => !cancelled && setFavicon(icon ?? FAVICON))
      .catch(() => !cancelled && setFavicon(FAVICON));
    return () => {
      cancelled = true;
    };
  }, [unreadCount, status]);
}
