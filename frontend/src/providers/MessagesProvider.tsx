import { WebhookMessage } from "@/components/WebhookMessagesPanel";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface MessagesContextType {
  messages: WebhookMessage[];
  setMessages: React.Dispatch<React.SetStateAction<WebhookMessage[]>>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(
  undefined
);

interface MessagesProviderProps {
  children: ReactNode;
}

export const MessagesProvider: React.FC<MessagesProviderProps> = ({
  children,
}) => {
  const [messages, setMessages] = useState<WebhookMessage[]>(() => {
    const saved = localStorage.getItem("messages");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  return (
    <MessagesContext.Provider value={{ messages, setMessages }}>
      {children}
    </MessagesContext.Provider>
  );
};

export function useMessages(): MessagesContextType {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error("useMessages must be used within a MessagesProvider");
  }
  return context;
}
