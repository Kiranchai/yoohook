import { useEffect } from "react";
import { ConnectionStatus } from "@/hooks/useWebSocket";

const BASE_TITLE = "yoohook · Inspector";

function drawFavicon(badge: string | null) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#161616";
  ctx.font = '600 44px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("y", size / 2, 46);

  if (badge) {
    ctx.fillStyle = "#161616";
    ctx.fillRect(size - 28, 0, 28, 28);
    ctx.fillStyle = badge;
    ctx.fillRect(size - 24, 0, 24, 24);
  }
  return canvas.toDataURL("image/png");
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = href.startsWith("data:") ? "image/png" : "image/svg+xml";
  link.href = href;
}

/** Unread count in the tab title, plus a blue/red corner on the favicon. */
export function useTabIndicator(unreadCount: number, status: ConnectionStatus) {
  useEffect(() => {
    if (status === "disconnected") document.title = `Offline · ${BASE_TITLE}`;
    else document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;

    const badge = status === "disconnected" ? "#da1e28" : unreadCount > 0 ? "#0f62fe" : null;
    const icon = badge ? drawFavicon(badge) : null;
    setFavicon(icon ?? "/favicon.svg");
  }, [unreadCount, status]);
}
