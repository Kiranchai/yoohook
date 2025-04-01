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

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!webhookId) return;

    const createWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
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

      ws.onclose = () => {
        toast.error("Websocket connection lost. Reconnecting...", {
          style: {
            background: "#ff0000",
          },
        });
        setTimeout(createWebSocket, 5000);
      };

      ws.onopen = () => {
        toast.success("WebSocket connected", {
          style: {
            background: "#4BB543",
          },
        });
      };

      return ws;
    };

    const ws = createWebSocket();
    return () => {
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [webhookId]);
};
