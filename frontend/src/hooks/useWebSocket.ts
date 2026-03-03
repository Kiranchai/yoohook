import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WebhookMessage } from "@/types/webhook";

interface UseWebSocketProps {
  webhookId: string;
  onMessage: (message: WebhookMessage) => void;
}

export const useWebSocket = ({ webhookId, onMessage }: UseWebSocketProps) => {
  const onMessageRef = useRef(onMessage);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasConnectedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!webhookId) return;

    const createWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return wsRef.current;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/${webhookId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
          return;
        }
        onMessageRef.current(data);

        toast("New Message", {
          description: `${data.protocol}://${data.host}${data.fullPath}`,
          style: {
            background: "#181818",
          },
        });
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (event.code !== 1000 && hasConnectedRef.current) {
          reconnectTimeoutRef.current = setTimeout(createWebSocket, 10000);
        }
      };

      ws.onopen = () => {
        setConnected(true);
        if (hasConnectedRef.current) {
          toast.success("Reconnected", {
            style: {
              background: "#4BB543",
            },
          });
        } else {
          toast.success("WebSocket connected", {
            style: {
              background: "#4BB543",
            },
          });
          hasConnectedRef.current = true;
        }
      };

      ws.onerror = () => {};

      return ws;
    };

    const ws = createWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close(1000, "Component unmounting");
        wsRef.current = null;
        hasConnectedRef.current = false;
      }
      setConnected(false);
    };
  }, [webhookId]);

  return { connected };
};
