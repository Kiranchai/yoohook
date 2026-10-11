import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Modal } from "@/components/ui/modal";
import AppHeader from "@/components/AppHeader";
import UrlBar from "@/components/UrlBar";
import ConnectionNotice from "@/components/ConnectionNotice";
import EmptyState from "@/components/EmptyState";
import RequestList from "@/components/RequestList";
import ResizableSplit from "@/components/ResizableSplit";
import RequestDetails from "@/components/details/RequestDetails";
import CustomResponsesDialog, { EndpointRef } from "@/components/responses/CustomResponsesDialog";
import { useMessages } from "@/providers/MessagesProvider";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTabIndicator } from "@/hooks/useTabIndicator";
import { SERVER_URL, formatTime, queryString, requestPath } from "@/lib/http";
import { notify } from "@/lib/notify";
import { WebhookMessage } from "@/types/webhook";

type Confirm = "clear" | "newUrl" | "editPath" | null;

function App() {
  const { webhookId: routeId, messageId } = useParams();
  const navigate = useNavigate();
  const { messages, addMessage, removeMessage, clearMessages, unread, markRead, markAllRead } = useMessages();

  const [webhookId, setWebhookId] = useState(
    () => routeId || localStorage.getItem("webhookId") || crypto.randomUUID(),
  );
  const [freshId, setFreshId] = useState<string | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout>>();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [customPath, setCustomPath] = useState("");
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [responsesTarget, setResponsesTarget] = useState<EndpointRef | null>(null);

  // A webhook id in the URL wins over the remembered one.
  useEffect(() => {
    if (routeId && routeId !== webhookId) setWebhookId(routeId);
  }, [routeId, webhookId]);

  useEffect(() => {
    localStorage.setItem("webhookId", webhookId);
    if (!routeId) navigate(`/${webhookId}/${messageId ?? ""}`, { replace: true });
  }, [webhookId, routeId, messageId, navigate]);

  const selected = messages.find((m) => m.id === messageId) ?? messages[0];

  // Pin the selection in the URL so new arrivals don't take over the details pane.
  useEffect(() => {
    if (routeId && selected && selected.id !== messageId) {
      navigate(`/${webhookId}/${selected.id}`, { replace: true });
    }
  }, [routeId, selected, messageId, webhookId, navigate]);

  useEffect(() => {
    if (selected) markRead(selected.id);
  }, [selected, markRead]);

  useEffect(() => () => clearTimeout(freshTimer.current), []);

  const handleMessage = useCallback(
    (message: WebhookMessage) => {
      addMessage(message);
      setFreshId(message.id);
      clearTimeout(freshTimer.current);
      freshTimer.current = setTimeout(() => setFreshId(null), 1700);
      notify({
        title: "New request",
        subtitle: `${message.method} ${requestPath(message)}${queryString(message.queryParams)}`,
        caption: `Received ${formatTime(message.time)}`,
        mono: true,
      });
    },
    [addMessage],
  );

  const handleReconnect = useCallback(() => {
    notify({ kind: "success", title: "Reconnected", subtitle: `Listening on ${webhookId.slice(0, 8)}`, mono: true });
  }, [webhookId]);

  const { status, retryIn, retryNow } = useWebSocket({
    webhookId,
    onMessage: handleMessage,
    onReconnect: handleReconnect,
  });

  const unreadCount = messages.filter((m) => unread.has(m.id)).length;
  useTabIndicator(unreadCount, status);

  const switchWebhook = (id: string) => {
    clearMessages();
    setWebhookId(id);
    navigate(`/${id}/`);
    setConfirm(null);
  };

  const deleteMessage = (id: string) => {
    removeMessage(id);
    if (id === selected?.id) navigate(`/${webhookId}/`);
  };

  const openResponses = (target: EndpointRef | null = null) => {
    setResponsesTarget(target);
    setResponsesOpen(true);
  };

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={300}>
      <div className="flex h-full flex-col overflow-hidden">
        <AppHeader onNewUrl={() => setConfirm("newUrl")} onOpenResponses={() => openResponses()} />
        <UrlBar
          webhookId={webhookId}
          status={status}
          retryIn={retryIn}
          onEdit={() => {
            setCustomPath(webhookId);
            setConfirm("editPath");
          }}
        />
        {status === "disconnected" && <ConnectionNotice retryIn={retryIn} onRetry={retryNow} />}

        {messages.length === 0 || !selected ? (
          <EmptyState webhookId={webhookId} onOpenResponses={() => openResponses()} />
        ) : (
          <ResizableSplit
            left={
              <RequestList
                messages={messages}
                selectedId={selected.id}
                unread={unread}
                freshId={freshId}
                dimmed={status === "disconnected"}
                onSelect={(id) => navigate(`/${webhookId}/${id}`)}
                onDelete={deleteMessage}
                onClearAll={() => setConfirm("clear")}
                onMarkAllRead={markAllRead}
              />
            }
            right={
              <RequestDetails
                message={selected}
                webhookId={webhookId}
                onEditResponse={(method, endpoint) => openResponses({ method, endpoint })}
              />
            }
          />
        )}
      </div>

      <Modal
        open={confirm === "clear"}
        onOpenChange={(o) => !o && setConfirm(null)}
        label="Requests"
        title="Clear all requests?"
        description={`This permanently deletes ${messages.length} saved requests from this browser. This cannot be undone.`}
        primary={{
          label: "Clear all",
          kind: "danger",
          onClick: () => {
            clearMessages();
            navigate(`/${webhookId}/`);
            setConfirm(null);
          },
        }}
      />

      <Modal
        open={confirm === "newUrl"}
        onOpenChange={(o) => !o && setConfirm(null)}
        label="Webhook URL"
        title="Generate a new URL?"
        description="You get a new webhook address. Requests saved for the current one are deleted."
        primary={{ label: "Generate", onClick: () => switchWebhook(crypto.randomUUID()) }}
      />

      <Modal
        open={confirm === "editPath"}
        onOpenChange={(o) => !o && setConfirm(null)}
        label="Webhook URL"
        title="Set a custom path"
        description="Saving a new path clears the current requests."
        primary={{
          label: "Save",
          disabled: !customPath.trim(),
          onClick: () => customPath.trim() && switchWebhook(customPath.trim()),
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="label-01">Webhook path</span>
          <span className="field flex items-center px-0 font-mono focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-white">
            <span className="whitespace-nowrap pl-4 text-text-helper">{SERVER_URL}/</span>
            <input
              autoFocus
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customPath.trim()) switchWebhook(customPath.trim());
              }}
              placeholder="my-webhook"
              className="h-full min-w-0 flex-1 border-0 bg-transparent pr-4 text-text-primary outline-none placeholder:text-text-placeholder"
            />
          </span>
        </label>
      </Modal>

      <CustomResponsesDialog
        open={responsesOpen}
        onOpenChange={setResponsesOpen}
        webhookId={webhookId}
        initial={responsesTarget}
      />

      <Toaster />
    </TooltipProvider>
  );
}

export default App;
