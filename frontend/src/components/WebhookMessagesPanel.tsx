import { useEffect, useCallback } from "react";
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
  const { messageId } = useParams();
  const webhookId = location.pathname.split("/")[1];

  useEffect(() => {
    const savedMessages = localStorage.getItem("messages");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, [location]);

  const handleNewMessage = useCallback(
    (data: WebhookMessage) => {
      setMessages((prevMessages) => {
        const newMessages = [data, ...prevMessages];
        localStorage.setItem("messages", JSON.stringify(newMessages));
        return newMessages;
      });
    },
    [setMessages]
  );

  useWebSocket({
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
    </ResizablePanel>
  );
}
