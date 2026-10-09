import { WebhookMessage } from "@/types/webhook";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface MessagesContextType {
  messages: WebhookMessage[];
  setMessages: React.Dispatch<React.SetStateAction<WebhookMessage[]>>;
  clearMessages: () => void;
  /** Adds a message at the top; it counts as unread unless the list was empty. */
  addMessage: (message: WebhookMessage) => void;
  removeMessage: (id: string) => void;
  unread: ReadonlySet<string>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const MessagesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<WebhookMessage[]>(() => readJson("messages", []));
  const [unread, setUnread] = useState<Set<string>>(() => new Set(readJson<string[]>("unread", [])));

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("unread", JSON.stringify(Array.from(unread)));
  }, [unread]);

  // Mirrors messages.length so addMessage stays stable and side-effect free.
  const countRef = useRef(messages.length);
  useEffect(() => {
    countRef.current = messages.length;
  }, [messages.length]);

  const addMessage = useCallback((message: WebhookMessage) => {
    if (countRef.current > 0) setUnread((u) => new Set(u).add(message.id));
    countRef.current += 1;
    setMessages((prev) => [message, ...prev]);
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setUnread((u) => {
      if (!u.has(id)) return u;
      const next = new Set(u);
      next.delete(id);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setUnread((u) => {
      if (!u.has(id)) return u;
      const next = new Set(u);
      next.delete(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => setUnread(new Set()), []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setUnread(new Set());
  }, []);

  return (
    <MessagesContext.Provider
      value={{ messages, setMessages, clearMessages, addMessage, removeMessage, unread, markRead, markAllRead }}
    >
      {children}
    </MessagesContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useMessages(): MessagesContextType {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error("useMessages must be used within a MessagesProvider");
  }
  return context;
}
