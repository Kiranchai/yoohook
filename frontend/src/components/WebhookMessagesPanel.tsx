import { useCallback } from "react";
import { ResizablePanel } from "./ui/resizable";
import { useLocation, useParams } from "react-router";
import { useMessages } from "@/providers/MessagesProvider";
import ClearAllButton from "./ClearAllButton";
import { WebhookMessageBlock } from "./WebhookMessageBlock";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebhookMessage } from "@/types/webhook";

export default function WebhookMessagesPanel() {
  const { messages, setMessages } = useMessages();
  const location = useLocation();
  const { messageId, webhookId: paramWebhookId } = useParams();
  const webhookId = paramWebhookId || location.pathname.split("/")[1];

  const handleNewMessage = useCallback(
    (data: WebhookMessage) => {
      setMessages((prevMessages) => [data, ...prevMessages]);
    },
    [setMessages],
  );

  const { connected } = useWebSocket({
    webhookId,
    onMessage: handleNewMessage,
  });

  return (
    <ResizablePanel defaultSize={20} minSize={20}>
      <div className="overflow-y-auto max-h-[calc(100vh-6rem)]">
        <div className="px-2 py-4 flex items-center justify-start">
          <ClearAllButton />
        </div>
        {messages.map((message) => (
          <WebhookMessageBlock
            key={message.id}
            message={message}
            isSelected={message.id === messageId}
          />
        ))}
      </div>
      {!connected && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold animate-pulse shadow-lg">
          Disconnected
        </div>
      )}
    </ResizablePanel>
  );
}
