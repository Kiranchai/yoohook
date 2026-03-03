import { useLocation, useParams } from "react-router";
import { ResizablePanel } from "./ui/resizable";
import { methodColors, WebhookMessage } from "@/types/webhook";
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
import ServerHeadersCollapsible from "./ServerHeadersCollapsible";
import yaml from "js-yaml";

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

  const getContentType = (): string => {
    if (!message?.headers) return "";
    const ct =
      message.headers["Content-Type"] || message.headers["content-type"] || "";
    return ct.toLowerCase();
  };

  const formatXML = (xmlString: string): string => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
      if (xmlDoc.querySelector("parsererror")) return xmlString;

      const serialize = (node: Node, depth: number): string => {
        const pad = "  ".repeat(depth);

        if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
          const pi = node as ProcessingInstruction;
          return `${pad}<?${pi.target} ${pi.data}?>`;
        }

        if (node.nodeType === Node.COMMENT_NODE) {
          return `${pad}<!--${node.textContent}-->`;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          return text || "";
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          let attrs = "";
          for (const attr of Array.from(el.attributes)) {
            attrs += ` ${attr.name}="${attr.value}"`;
          }

          const children = Array.from(el.childNodes)
            .map((child) => serialize(child, depth + 1))
            .filter(Boolean);

          if (children.length === 0) {
            return `${pad}<${el.tagName}${attrs} />`;
          }

          if (
            children.length === 1 &&
            el.childNodes[0].nodeType === Node.TEXT_NODE
          ) {
            return `${pad}<${el.tagName}${attrs}>${el.childNodes[0].textContent?.trim()}</${el.tagName}>`;
          }

          return `${pad}<${el.tagName}${attrs}>\n${children.join("\n")}\n${pad}</${el.tagName}>`;
        }

        if (node.nodeType === Node.DOCUMENT_NODE) {
          return Array.from(node.childNodes)
            .map((child) => serialize(child, depth))
            .filter(Boolean)
            .join("\n");
        }

        return "";
      };

      const xmlDecl = xmlString.match(/^<\?xml[^?]*\?>/);
      const body = serialize(xmlDoc, 0);
      return xmlDecl ? `${xmlDecl[0]}\n${body}` : body;
    } catch {
      return xmlString;
    }
  };

  const formatYAML = (yamlString: string): string => {
    try {
      const parsed = yaml.load(yamlString);
      return yaml.dump(parsed, { indent: 2, lineWidth: -1 });
    } catch {
      return yamlString;
    }
  };

  const formatFormUrlEncoded = (value: string): string => {
    try {
      const params = new URLSearchParams(value);
      return Array.from(params.entries())
        .map(([k, v]) => `${decodeURIComponent(k)} = ${decodeURIComponent(v)}`)
        .join("\n");
    } catch {
      return value;
    }
  };

  const getBodyText = (formatted: boolean): string => {
    const contentType = getContentType();

    if (typeof message.body === "string") {
      if (!formatted) return message.body;

      // JSON string
      try {
        const parsed = JSON.parse(message.body);
        return JSON.stringify(parsed, null, 2);
      } catch {}

      // XML
      if (contentType.includes("xml")) {
        return formatXML(message.body);
      }

      // Form URL-encoded
      if (contentType.includes("x-www-form-urlencoded")) {
        return formatFormUrlEncoded(message.body);
      }

      // YAML
      if (
        contentType.includes("yaml") ||
        contentType.includes("x-yaml")
      ) {
        return formatYAML(message.body);
      }

      return message.body;
    }

    if (typeof message.body === "object") {
      return formatted
        ? JSON.stringify(message.body, null, 2)
        : JSON.stringify(message.body);
    }

    return String(message.body);
  };

  const handleCopyBody = () => {
    const copiedText = getBodyText(bodyFormatted);
    navigator.clipboard.writeText(copiedText);

    toast("Copied to clipboard", {
      description: `${copiedText.slice(0, 30)}...`,
      style: {
        background: "#181818",
      },
    });
  };

  const serverHeaders = [
    "X-Forwarded-For",
    "X-Forwarded-Host",
    "X-Forwarded-Proto",
    "X-Forwarded-Port",
    "X-Forwarded-Server",
    "X-Railway-Edge",
    "X-Railway-Request-Id",
    "X-Real-Ip",
    "X-Request-Start",
    "Cdn-Loop",
    "Cf-Connecting-Ip",
    "Cf-Ipcountry",
    "Cf-Ray",
    "Cf-Visitor",
  ];

  const renderBodyContent = () => {
    return <pre>{getBodyText(bodyFormatted)}</pre>;
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
                    Object.entries(message.headers)
                      .filter((header) => !serverHeaders.includes(header[0]))
                      .map(([key, value]) => (
                        <TableRow
                          className="hover:bg-secondary border-secondary"
                          key={key}
                        >
                          <TableCell className="font-medium p-2">
                            {key}
                          </TableCell>
                          <TableCell className="p-0">{value}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
            <ServerHeadersCollapsible
              message={message}
              serverHeaders={serverHeaders}
            />
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
                        <TableCell className="p-0">
                          {JSON.stringify(value)}
                        </TableCell>
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
                Pretty print
              </label>
            </div>
            <Button onClick={handleCopyBody}>Copy body</Button>
          </div>
          {message?.body && (typeof message.body === "string" ? (message.body as string).length > 0 : Object.keys(message.body).length > 0) ? (
            <pre className=" overflow-y-auto overflow-x-auto ">
              {renderBodyContent()}
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
