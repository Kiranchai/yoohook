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
import { Textarea } from "./ui/textarea";
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
  const [endpoint, setEndpoint] = useState(path);
  const [method_, setMethod_] = useState(method);
  const [statusCode, setStatusCode] = useState("");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();

  const resetForm = () => {
    setEndpoint(path);
    setMethod_(method);
    setStatusCode("");
    setHeaders("");
    setBody("");
  };

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    const storedResponses = localStorage.getItem("customResponses");
    if (!storedResponses) return;

    try {
      const responsesArray = JSON.parse(storedResponses);

      const savedResponse = responsesArray.find(
        (resp: any) => resp.method === method_ && resp.endpoint === endpoint
      );

      if (savedResponse) {
        setStatusCode(savedResponse.statusCode || "");
        setHeaders(
          savedResponse.headers
            ? JSON.stringify(savedResponse.headers, null, 2)
            : ""
        );
        setBody(
          savedResponse.body ? JSON.stringify(savedResponse.body, null, 2) : ""
        );
      } else {
        setStatusCode("");
        setHeaders("");
        setBody("");
      }
    } catch (error) {
      console.error("Error parsing stored responses:", error);
    }
  }, [isDialogOpen, endpoint, method_]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
          setErrorMessage("");
          resetForm();
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
      <DialogContent className="sm:max-w-[425px]">
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
          <div className="flex items-center gap-5">
            <Label htmlFor="headers">Headers</Label>
            <Textarea
              id="headers"
              placeholder='{"Content-Type": "application/json"}'
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setHeaders(e.currentTarget.value);
              }}
              value={headers}
            />
          </div>
          <div className="flex items-center gap-11">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              placeholder='{"token": "Bearer eyJhbGciOiJIUzI1NIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiw"}'
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setBody(e.currentTarget.value);
              }}
              value={body}
            />
          </div>
        </div>
        <DialogFooter>
          <div className="flex flex-col gap-2 text-end">
            <Button
              onClick={async (
                e: React.MouseEvent<HTMLButtonElement, MouseEvent>
              ) => {
                e.preventDefault();

                if (body === "" || headers === "") {
                  setErrorMessage("Body and headers must be an object");
                  return;
                }

                if (statusCode === "") {
                  setErrorMessage("Status code has to be set");
                  return;
                }

                let parsedHeaders, parsedBody;
                try {
                  parsedHeaders = JSON.parse(headers);
                  parsedBody = JSON.parse(body);
                } catch (error) {
                  setErrorMessage("Invalid JSON format in headers or body");
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
                      }),
                    }
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
                    };

                    const existingIndex = responsesArray.findIndex(
                      (resp: any) =>
                        resp.method === method_ && resp.endpoint === endpoint
                    );

                    if (existingIndex !== -1) {
                      responsesArray[existingIndex] = newResponse;
                    } else {
                      responsesArray.push(newResponse);
                    }

                    localStorage.setItem(
                      "customResponses",
                      JSON.stringify(responsesArray)
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
                      : "Network error or invalid server response"
                  );
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              {isLoading ? "Loading..." : "Save changes"}
            </Button>
            <span className="text-red-500">{errorMessage}</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
