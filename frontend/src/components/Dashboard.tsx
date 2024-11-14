import {
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import WebhookMessagesPanel from "./WebhookMessagesPanel";
import MessageDetailsPanel from "./MessageDetailsPanel";

export default function Dashboard({ children }: { children: React.ReactNode }) {
  return (
    <ResizablePanelGroup
      className="min-h-[calc(100vh-6rem)] relative"
      direction="horizontal"
    >
      {children}
      <WebhookMessagesPanel />
      <ResizableHandle />
      <MessageDetailsPanel />
    </ResizablePanelGroup>
  );
}
