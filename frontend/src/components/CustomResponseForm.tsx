import { MdModeEdit } from "react-icons/md";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FaPlus } from "react-icons/fa";
import Editor from "@monaco-editor/react";

export default function CustomResponseForm({
  path,
  method,
  disabledUrl,
  newButton,
}: {
  path: string;
  method: string;
  disabledUrl: boolean;
  newButton: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [endpoint, setEndpoint] = useState(path);
  const [method_, setMethod_] = useState(method);
  const [statusCode, setStatusCode] = useState("");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  type BodyFormat =
    | "json"
    | "xml"
    | "text"
    | "html"
    | "yaml"
    | "form-urlencoded"
    | "raw";

  const getMonacoLanguage = (format: BodyFormat): string => {
    switch (format) {
      case "json":
        return "json";
      case "xml":
        return "xml";
      case "html":
        return "html";
      case "yaml":
        return "yaml";
      default:
        return "plaintext";
    }
  };

  const [bodyFormat, setBodyFormat] = useState<BodyFormat>("json");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [headersError, setHeadersError] = useState("");
  const [bodyError, setBodyError] = useState("");
  const location = useLocation();

  const defineCustomTheme = (monaco: any) => {
    if (!document.getElementById("monaco-custom-fonts")) {
      const style = document.createElement("style");
      style.id = "monaco-custom-fonts";
      style.textContent = `
        .monaco-editor .view-lines {
          font-family: 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace !important;
          font-size: 14px !important;
          font-feature-settings: "liga" 1, "calt" 1 !important;
        }
        .monaco-editor * {
          font-family: 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace !important;
        }
      `;
      document.head.appendChild(style);
    }

    monaco.editor.defineTheme("webhook-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "fafafa", background: "0a0a0a" },
        { token: "string", foreground: "9ecbff" },
        { token: "number", foreground: "b5cea8" },
        { token: "keyword", foreground: "c586c0" },
        { token: "operator", foreground: "d4d4d4" },
        { token: "delimiter", foreground: "a5a5a5" },
        { token: "comment", foreground: "6a9955" },
        { token: "tag", foreground: "569cd6" },
        { token: "attribute.name", foreground: "9cdcfe" },
        { token: "attribute.value", foreground: "ce9178" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#fafafa",
        "editor.lineHighlightBackground": "#1e1e1e",
        "editor.selectionBackground": "#3b4047",
        "editor.inactiveSelectionBackground": "#2a2a2a",
        "editorCursor.foreground": "#fafafa",
        "editorWhitespace.foreground": "#3b3b3b",
        "editorIndentGuide.background": "#404040",
        "editorIndentGuide.activeBackground": "#707070",
        "editorLineNumber.foreground": "#a5a5a5",
        "editorLineNumber.activeForeground": "#fafafa",
        "scrollbar.shadow": "#000000",
        "scrollbarSlider.background": "#3b4047",
        "scrollbarSlider.hoverBackground": "#4b4b4b",
        "scrollbarSlider.activeBackground": "#555555",
        "editor.findMatchBackground": "#515c6a",
        "editor.findMatchHighlightBackground": "#ea5c004d",
        "editorBracketMatch.background": "#0064001a",
        "editorBracketMatch.border": "#888888",
        "editorError.foreground": "#f44747",
        "editorWarning.foreground": "#ff8c00",
        "editorInfo.foreground": "#75beff",
      },
    });
  };

  const formatJSON = (jsonString: string): string => {
    if (!jsonString.trim()) return "";
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return jsonString;
    }
  };

  const validateJSON = (jsonString: string): string => {
    if (!jsonString.trim()) return "";
    try {
      JSON.parse(jsonString);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  };

  const formatXML = (xmlString: string): string => {
    if (!xmlString.trim()) return "";
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");

      const errorNode = xmlDoc.querySelector("parsererror");
      if (errorNode) {
        return xmlString;
      }

      let formatted = xmlString;

      formatted = formatted.replace(/>\s*</g, "><");
      formatted = formatted.replace(/></g, ">\n<");

      const lines = formatted.split("\n");
      let indent = 0;

      return lines
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.length === 0) return "";

          if (trimmed.startsWith("</")) {
            indent = Math.max(0, indent - 1);
          }

          const indentedLine = "  ".repeat(indent) + trimmed;

          if (
            trimmed.startsWith("<") &&
            !trimmed.startsWith("</") &&
            !trimmed.endsWith("/>") &&
            !trimmed.includes("<?xml")
          ) {
            indent++;
          }

          return indentedLine;
        })
        .join("\n");
    } catch (error) {
      return xmlString;
    }
  };

  const validateXML = (xmlString: string): string => {
    if (!xmlString.trim()) return "";
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");

      const errorNode = xmlDoc.querySelector("parsererror");
      if (errorNode) {
        return "Invalid XML format";
      }

      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid XML";
    }
  };

  const validateFormUrlEncoded = (value: string): string => {
    if (!value.trim()) return "";
    const segments = value.split("&");
    for (const segment of segments) {
      if (segment && !segment.includes("=")) {
        return "Each parameter must contain '=' (e.g. key=value&key2=value2)";
      }
    }
    return "";
  };

  const handleHeadersChange = (value: string) => {
    setHeaders(value);
    const error = validateJSON(value);
    setHeadersError(error);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    let error = "";
    switch (bodyFormat) {
      case "json":
        error = validateJSON(value);
        break;
      case "xml":
        error = validateXML(value);
        break;
      case "form-urlencoded":
        error = validateFormUrlEncoded(value);
        break;
      default:
        break;
    }
    setBodyError(error);
  };

  const handleFormatChange = (format: BodyFormat) => {
    setBodyFormat(format);
    if (body) {
      let error = "";
      switch (format) {
        case "json":
          error = validateJSON(body);
          break;
        case "xml":
          error = validateXML(body);
          break;
        case "form-urlencoded":
          error = validateFormUrlEncoded(body);
          break;
        default:
          break;
      }
      setBodyError(error);
    }

    if (!body.trim()) {
      setBody("");
    }
  };

  const handleHeadersBlur = () => {
    if (headers && !headersError) {
      const formatted = formatJSON(headers);
      setHeaders(formatted);
    }
  };

  const handleBodyBlur = () => {
    if (body && !bodyError) {
      switch (bodyFormat) {
        case "json":
          setBody(formatJSON(body));
          break;
        case "xml":
          setBody(formatXML(body));
          break;
        default:
          break;
      }
    }
  };

  const insertHeadersTemplate = () => {
    const template = {
      Authorization: "Bearer your-token-here",
      "X-API-Key": "your-api-key",
    };
    const formatted = JSON.stringify(template, null, 2);
    setHeaders(formatted);
    setHeadersError("");
  };

  const insertBodyTemplate = () => {
    switch (bodyFormat) {
      case "json": {
        const template = {
          status: "success",
          message: "Request processed successfully",
          data: {
            id: 1,
            name: "Example Response",
            created_at: new Date().toISOString(),
          },
        };
        setBody(JSON.stringify(template, null, 2));
        break;
      }
      case "xml": {
        setBody(`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>success</status>
  <message>Request processed successfully</message>
  <data>
    <id>1</id>
    <name>Example Response</name>
    <created_at>${new Date().toISOString()}</created_at>
  </data>
</response>`);
        break;
      }
      case "text": {
        setBody("Request processed successfully.");
        break;
      }
      case "html": {
        setBody(`<!DOCTYPE html>
<html>
<head>
  <title>Response</title>
</head>
<body>
  <h1>Success</h1>
  <p>Request processed successfully.</p>
</body>
</html>`);
        break;
      }
      case "yaml": {
        setBody(`status: success
message: Request processed successfully
data:
  id: 1
  name: Example Response
  created_at: "${new Date().toISOString()}"`);
        break;
      }
      case "form-urlencoded": {
        setBody("status=success&message=Request+processed+successfully");
        break;
      }
      case "raw": {
        setBody("");
        break;
      }
    }
    setBodyError("");
  };

  const resetForm = () => {
    setEndpoint(path);
    setMethod_(method);
    setStatusCode("");
    setHeaders("");
    setBody("");
    setBodyFormat("json");
    setHeadersError("");
    setBodyError("");
  };

  useEffect(() => {
    if (isDialogOpen) {
      const timeout = setTimeout(() => setIsEditorReady(true), 150);
      return () => clearTimeout(timeout);
    } else {
      setIsEditorReady(false);
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    if (!isEditorReady) {
      return;
    }

    const storedResponses = localStorage.getItem("customResponses");
    if (!storedResponses) return;

    try {
      const responsesArray = JSON.parse(storedResponses);

      const savedResponse = responsesArray.find(
        (resp: any) => resp.method === method_ && resp.endpoint === endpoint,
      );

      if (savedResponse) {
        setStatusCode(savedResponse.statusCode || "");
        const formattedHeaders = savedResponse.headers
          ? JSON.stringify(savedResponse.headers, null, 2)
          : "";

        const savedBodyFormat = savedResponse.bodyFormat || "json";
        setBodyFormat(savedBodyFormat);

        let formattedBody = "";
        if (savedResponse.body) {
          if (
            savedBodyFormat === "json" &&
            typeof savedResponse.body === "object"
          ) {
            formattedBody = JSON.stringify(savedResponse.body, null, 2);
          } else {
            formattedBody =
              typeof savedResponse.body === "string"
                ? savedResponse.body
                : JSON.stringify(savedResponse.body, null, 2);
          }
        }

        setHeaders(formattedHeaders);
        setBody(formattedBody);
        setHeadersError("");
        setBodyError("");
      } else {
        setStatusCode("");
        setHeaders("");
        setBody("");
        setBodyFormat("json");
        setHeadersError("");
        setBodyError("");
      }
    } catch (error) {
      console.error("Error parsing stored responses:", error);
    }
  }, [isDialogOpen, isEditorReady, endpoint, method_]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setErrorMessage("");
          setHeadersError("");
          setBodyError("");
        }
      }}
    >
      <DialogTrigger asChild>
        {newButton ? (
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-secondary font-bold hover:bg-primary"
          >
            New endpoint
            <FaPlus />
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 bg-secondary w-10 h-10 text-white"
            >
              <MdModeEdit />
            </Button>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Set custom responses</DialogTitle>
          <DialogDescription>
            Requests sent to this endpoint will contain the following data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              type="text"
              id="endpoint"
              placeholder="/api/v3/user"
              defaultValue={path}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setEndpoint(e.currentTarget.value);
              }}
              disabled={disabledUrl}
            />
          </div>
          <div className="flex items-center gap-5">
            <Label htmlFor="method">Method</Label>
            <Select
              onValueChange={(value) => setMethod_(value)}
              defaultValue={method}
              disabled={disabledUrl}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                <SelectItem value="HEAD">HEAD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="statusCode">Status Code</Label>
            <Input
              type="number"
              id="statusCode"
              placeholder="404"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStatusCode(e.currentTarget.value);
              }}
              value={statusCode}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="headers">Headers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={insertHeadersTemplate}
                className="text-xs px-2 py-1 h-auto"
              >
                Insert Template
              </Button>
            </div>
            <div
              className={`border rounded-md ${
                headersError ? "border-destructive" : "border-input"
              }`}
            >
              {isEditorReady ? (
                <Editor
                  height="120px"
                  defaultLanguage="json"
                  value={headers}
                  onChange={(value: string | undefined) =>
                    handleHeadersChange(value || "")
                  }
                  beforeMount={(monaco: any) => {
                    defineCustomTheme(monaco);
                  }}
                  onMount={(editor: any) => {
                    editor.onDidBlurEditorText(() => {
                      handleHeadersBlur();
                    });

                    editor.addAction({
                      id: "format-headers",
                      label: "Format Headers",
                      keybindings: [2048 + 1024 + 36],
                      run: () => {
                        editor.getAction("editor.action.formatDocument").run();
                      },
                    });
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily:
                      "'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
                    fontLigatures: true,
                    lineNumbers: "off",
                    folding: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    padding: { top: 8, bottom: 8 },
                    suggestOnTriggerCharacters: false,
                    quickSuggestions: false,
                    formatOnPaste: true,
                    formatOnType: false,
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: false,
                    bracketPairColorization: { enabled: true },
                    renderValidationDecorations: "off",
                    renderLineHighlight: "none",
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                  }}
                  theme="webhook-dark"
                />
              ) : (
                <div className="h-[120px] bg-[#0a0a0a] rounded-md flex items-center justify-center text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Loading editor...
                  </div>
                </div>
              )}
            </div>
            {headersError && (
              <span className="text-destructive text-xs">{headersError}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Body</Label>
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={(value) =>
                    handleFormatChange(value as BodyFormat)
                  }
                  defaultValue="json"
                  value={bodyFormat}
                >
                  <SelectTrigger className="w-36 h-auto text-xs px-2 py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="yaml">YAML</SelectItem>
                    <SelectItem value="form-urlencoded">
                      Form URL-encoded
                    </SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={insertBodyTemplate}
                  className="text-xs px-2 py-1 h-auto"
                >
                  Insert Template
                </Button>
              </div>
            </div>
            <div
              className={`border rounded-md ${
                bodyError ? "border-destructive" : "border-input"
              }`}
            >
              {isEditorReady ? (
                <Editor
                  height="200px"
                  defaultLanguage={getMonacoLanguage(bodyFormat)}
                  language={getMonacoLanguage(bodyFormat)}
                  value={body}
                  onChange={(value: string | undefined) =>
                    handleBodyChange(value || "")
                  }
                  beforeMount={(monaco: any) => {
                    defineCustomTheme(monaco);
                  }}
                  onMount={(editor: any) => {
                    editor.onDidBlurEditorText(() => {
                      handleBodyBlur();
                    });

                    editor.addAction({
                      id: "format-content",
                      label: "Format Content",
                      keybindings: [2048 + 1024 + 36], // Ctrl+Shift+F
                      run: () => {
                        editor.getAction("editor.action.formatDocument").run();
                      },
                    });
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily:
                      "'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
                    fontLigatures: true,
                    lineNumbers: "on",
                    folding: true,
                    wordWrap: "on",
                    automaticLayout: true,
                    padding: { top: 8, bottom: 8 },
                    suggestOnTriggerCharacters: false,
                    quickSuggestions: false,
                    formatOnPaste: true,
                    formatOnType: false,
                    bracketPairColorization: { enabled: true },
                    renderValidationDecorations: "off",
                    renderLineHighlight: "gutter",
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                  }}
                  theme="webhook-dark"
                />
              ) : (
                <div className="h-[200px] bg-[#0a0a0a] rounded-md flex items-center justify-center text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Loading editor...
                  </div>
                </div>
              )}
            </div>
            {bodyFormat === "raw" && (
              <span className="text-yellow-500 text-xs">
                Set Content-Type in headers
              </span>
            )}
            {bodyError && (
              <span className="text-destructive text-xs">{bodyError}</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <div className="flex flex-col gap-2 text-end">
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async (
                  e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
                ) => {
                  e.preventDefault();

                  if (headersError || bodyError) {
                    setErrorMessage(
                      "Please fix validation errors before saving",
                    );
                    return;
                  }

                  if (headers === "" || (body === "" && bodyFormat !== "raw")) {
                    setErrorMessage("Body and headers must be provided");
                    return;
                  }

                  if (statusCode === "") {
                    setErrorMessage("Status code has to be set");
                    return;
                  }

                  let parsedHeaders, parsedBody;
                  try {
                    parsedHeaders = JSON.parse(headers);

                    if (bodyFormat === "json") {
                      parsedBody = JSON.parse(body);
                    } else {
                      parsedBody = body;
                    }
                  } catch (error) {
                    setErrorMessage("Invalid format in headers or body");
                    setIsLoading(false);
                    return;
                  }

                  setIsLoading(true);

                  try {
                    const res = await fetch(
                      `${import.meta.env.VITE_SERVER_URL}/set-response/${
                        location.pathname.split("/")[1]
                      }/${method_}${endpoint}`,
                      {
                        headers: {
                          "Content-Type": "application/json",
                        },
                        method: "POST",
                        body: JSON.stringify({
                          statusCode,
                          headers: parsedHeaders,
                          body: parsedBody,
                          bodyFormat: bodyFormat,
                        }),
                      },
                    );

                    if (res.ok) {
                      const data = await res.json();

                      const storedResponses =
                        localStorage.getItem("customResponses");
                      let responsesArray = storedResponses
                        ? JSON.parse(storedResponses)
                        : [];

                      const newResponse = {
                        method: method_,
                        endpoint: endpoint || "/",
                        statusCode,
                        headers: parsedHeaders,
                        body: parsedBody,
                        bodyFormat: bodyFormat,
                      };

                      const existingIndex = responsesArray.findIndex(
                        (resp: any) =>
                          resp.method === method_ && resp.endpoint === endpoint,
                      );

                      if (existingIndex !== -1) {
                        responsesArray[existingIndex] = newResponse;
                      } else {
                        responsesArray.push(newResponse);
                      }

                      localStorage.setItem(
                        "customResponses",
                        JSON.stringify(responsesArray),
                      );

                      setIsDialogOpen(false);
                      toast(data.message, {
                        description: data.path,
                        style: {
                          background: "#181818",
                        },
                      });
                      setErrorMessage("");
                      resetForm();
                    } else {
                      const errorData = await res.json();
                      setErrorMessage(errorData.error);
                    }
                  } catch (error) {
                    setErrorMessage(
                      error instanceof Error
                        ? error.message
                        : "Network error or invalid server response",
                    );
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
            </div>
            <span className="text-destructive">{errorMessage}</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
