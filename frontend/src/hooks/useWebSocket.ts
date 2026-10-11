import { useCallback, useEffect, useRef, useState } from "react";
import { WebhookMessage } from "@/types/webhook";
import { WS_URL } from "@/lib/http";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const RETRY_SECONDS = 10;

interface UseWebSocketProps {
  webhookId: string;
  onMessage: (message: WebhookMessage) => void;
  /** Called when the socket opens again after having been lost. */
  onReconnect?: () => void;
}

export const useWebSocket = ({ webhookId, onMessage, onReconnect }: UseWebSocketProps) => {
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnected = useRef(false);
  const connectRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    onMessageRef.current = onMessage;
    onReconnectRef.current = onReconnect;
  }, [onMessage, onReconnect]);

  useEffect(() => {
    if (!webhookId) return;
    let disposed = false;

    const clearRetry = () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      setRetryAt(null);
    };

    const connect = () => {
      clearRetry();
      wsRef.current?.close(1000);
      setStatus("connecting");

      const ws = new WebSocket(`${WS_URL}/${webhookId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setStatus("connected");
        if (hasConnected.current) onReconnectRef.current?.();
        hasConnected.current = true;
      };

      ws.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = (event) => {
        if (disposed || wsRef.current !== ws || event.code === 1000) return;
        setStatus("disconnected");
        setRetryAt(Date.now() + RETRY_SECONDS * 1000);
        retryTimer.current = setTimeout(connect, RETRY_SECONDS * 1000);
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      disposed = true;
      clearRetry();
      wsRef.current?.close(1000, "Component unmounting");
      wsRef.current = null;
      hasConnected.current = false;
    };
  }, [webhookId]);

  // Tick once a second while a retry is scheduled, for the countdown.
  useEffect(() => {
    if (retryAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [retryAt]);

  const retryNow = useCallback(() => connectRef.current(), []);

  const retryIn = retryAt === null ? null : Math.max(0, Math.ceil((retryAt - now) / 1000));

  return { status, retryIn, retryNow };
};
