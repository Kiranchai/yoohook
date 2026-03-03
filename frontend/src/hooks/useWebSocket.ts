import { useEffect, useRef } from "react";
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
        const data = JSON.parse(event.data);
        onMessageRef.current(data);

        toast("New Message", {
          description: `${data.protocol}://${data.host}${data.fullPath}`,
          style: {
            background: "#181818",
          },
        });
      };

      ws.onclose = (event) => {
        if (event.code !== 1000 && hasConnectedRef.current) {
          toast.error("Connection lost. Reconnecting...", {
            style: {
              background: "#ff0000",
            },
          });

          reconnectTimeoutRef.current = setTimeout(createWebSocket, 10000);
        }
      };

      ws.onopen = () => {
        if (!hasConnectedRef.current) {
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
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting");
        wsRef.current = null;
        hasConnectedRef.current = false;
      }
    };
  }, [webhookId]);
};
