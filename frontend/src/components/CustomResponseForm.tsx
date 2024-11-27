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
import { useState } from "react";
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
    setErrorMessage("");
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) {
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
              defaultValue={"/" + path}
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
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2">
          <Button
            onClick={async (
              e: React.MouseEvent<HTMLButtonElement, MouseEvent>
            ) => {
              e.preventDefault();
              setIsLoading(true);

              try {
                let inPathEndpoint = endpoint;

                if (!inPathEndpoint.startsWith("/")) {
                  inPathEndpoint = "/" + inPathEndpoint;
                }

                if (inPathEndpoint === "/") {
                  inPathEndpoint = "";
                }

                const res = await fetch(
                  `${import.meta.env.VITE_SERVER_URL}/set-response/${
                    location.pathname.split("/")[1]
                  }/${method_}${inPathEndpoint}`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      statusCode,
                      headers: JSON.parse(headers),
                      body: JSON.parse(body),
                    }),
                  }
                );

                if (res.ok) {
                  const data = await res.json();
                  setIsDialogOpen(false);
                  toast(data.message, {
                    description: data.path,
                    style: {
                      background: "#181818",
                    },
                  });
                } else {
                  const errorData = await res.json();
                  setErrorMessage(errorData.error);
                }
              } catch (error) {
                setErrorMessage("Network error or invalid server response");
              } finally {
                resetForm();
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? "Loading..." : "Save changes"}
          </Button>
          {errorMessage}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
