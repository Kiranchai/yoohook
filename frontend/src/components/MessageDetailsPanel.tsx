import { useLocation, useParams } from "react-router";
import { ResizablePanel } from "./ui/resizable";
import { methodColors, WebhookMessage } from "./WebhookMessagesPanel";
import { useEffect, useState } from "react";
import { useMessages } from "@/providers/MessagesProvider";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MessageDetailsPanel: React.FC = () => {
  const { messageId } = useParams();
  const [message, setMessage] = useState<WebhookMessage | null>(null);
  const { messages } = useMessages();
  const location = useLocation();

  const [bodyFormatted, setBodyFormatted] = useState(true);

  useEffect(() => {
    const savedMessages = localStorage.getItem("messages");

    if (savedMessages) {
      const storageMessages: WebhookMessage[] = JSON.parse(savedMessages);
      const foundMessage = storageMessages.find((msg) => msg.id === messageId);
      setMessage(foundMessage || messages[0] || null);
    } else {
      setMessage(messages[0]);
    }
  }, [messageId, location, messages]);

  if (message === null) {
    return (
      <ResizablePanel defaultSize={80} className="p-8">
        <div>Waiting for messages.</div>;
      </ResizablePanel>
    );
  }

  const handleCopyBody = () => {
    let copiedText = "";
    if (typeof message.body === "string") {
      try {
        const parsedBody = JSON.parse(message.body);
        navigator.clipboard.writeText(
          bodyFormatted
            ? JSON.stringify(parsedBody, null, 2)
            : JSON.stringify(parsedBody)
        );
        copiedText = bodyFormatted
          ? JSON.stringify(parsedBody, null, 2)
          : JSON.stringify(parsedBody);
      } catch (e) {
        console.error(e);
      }
    } else {
      navigator.clipboard.writeText(
        bodyFormatted
          ? JSON.stringify(message.body, null, 2)
          : JSON.stringify(message.body)
      );
      copiedText = bodyFormatted
        ? JSON.stringify(message.body, null, 2)
        : JSON.stringify(message.body);
    }

    toast("Copied to clipboard", {
      description: `${copiedText.slice(0, 30)}...`,
      style: {
        background: "#181818",
      },
    });
  };

  const renderBodyContent = () => {
    if (typeof message.body === "string") {
      try {
        const parsedBody = JSON.parse(message.body);
        return <pre>{JSON.stringify(parsedBody, null, 2)}</pre>;
      } catch (e) {
        return <pre>{message.body}</pre>;
      }
    }

    if (typeof message.body === "object") {
      return <pre>{JSON.stringify(message.body, null, 2)}</pre>;
    }

    // For non-JSON content
    return String(message.body);
  };

  return (
    <ResizablePanel
      defaultSize={80}
      className="p-8 max-h-[calc(100vh-6rem)] h-full !overflow-auto"
    >
      <div className="flex gap-4 items-center mb-12 ">
        <div
          style={{ backgroundColor: methodColors[message?.method] }}
          className="text-2xl bg px-4 py-2 rounded-md"
        >
          {message?.method}
        </div>
        <h1 className="font-bold text-2xl truncate text-ellipsis overflow-hidden whitespace-nowrap max-w-[70rem]">
          /{message?.path}
        </h1>
        <span className="opacity-50">ID: {message?.id}</span>
      </div>
      <div className="flex flex-col gap-4 h-full">
        <div className="grid grid-cols-2 items-start gap-8 max-w-[90rem] w-full">
          <div className="flex flex-col gap-4">
            <span className="text-2xl font-bold">Headers:</span>
            <div className="w-full text-sm">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-primary border-secondary">
                    <TableHead className="w-[300px] px-0">Key</TableHead>
                    <TableHead className="px-0">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {message?.headers &&
                    Object.entries(message.headers).map(([key, value]) => (
                      <TableRow
                        className="hover:bg-secondary border-secondary"
                        key={key}
                      >
                        <TableCell className="font-medium p-2">{key}</TableCell>
                        <TableCell className="p-0">{value}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-col gap-4 max-w-[45rem] w-full h-full">
            <span className="text-2xl font-bold">Query parameters:</span>
            <div className="w-full text-sm">
              {message?.queryParams &&
              Object.entries(message?.queryParams).length > 0 ? (
                <Table className="text-sm ">
                  <TableHeader>
                    <TableRow className="hover:bg-primary border-secondary">
                      <TableHead className="w-[300px] px-0">Key</TableHead>
                      <TableHead className="px-0">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(message?.queryParams).map(
                      ([key, value]) => (
                        <TableRow
                          className="hover:bg-secondary border-secondary"
                          key={key}
                        >
                          <TableCell className="font-medium p-2">
                            {key}
                          </TableCell>
                          <TableCell className="p-0">{value}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              ) : (
                "No content"
              )}
            </div>
            <span className="text-2xl font-bold mt-12">Form data:</span>
            <div className="w-full text-sm">
              {message?.formData &&
              Object.entries(message?.formData).length > 0 ? (
                <Table className="text-sm ">
                  <TableHeader>
                    <TableRow className="hover:bg-primary border-secondary">
                      <TableHead className="w-[300px] px-0">Key</TableHead>
                      <TableHead className="px-0">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(message?.formData).map(([key, value]) => (
                      <TableRow
                        className="hover:bg-secondary border-secondary"
                        key={key}
                      >
                        <TableCell className="font-medium p-2">
                          {key.charAt(0).toUpperCase()}
                          {key.slice(1)}
                        </TableCell>
                        <TableCell className="p-0">{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                "No content"
              )}
            </div>
          </div>
        </div>
        <div className="bg-secondary p-4 rounded-md flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="format"
                className="border-gray-500"
                checked={bodyFormatted}
                onCheckedChange={(isChecked) => {
                  setBodyFormatted(isChecked as boolean);
                }}
              />
              <label
                htmlFor="format"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Format JSON
              </label>
            </div>
            <Button onClick={handleCopyBody}>Copy body</Button>
          </div>
          {message?.body && Object.keys(message?.body).length > 0 ? (
            <pre className=" overflow-y-auto overflow-x-auto ">
              {bodyFormatted ? (
                renderBodyContent()
              ) : (
                <pre>{JSON.stringify(message?.body)}</pre>
              )}
            </pre>
          ) : (
            "No content"
          )}
        </div>
      </div>
    </ResizablePanel>
  );
};

export default MessageDetailsPanel;
