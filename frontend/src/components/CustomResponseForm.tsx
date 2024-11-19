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

export default function CustomResponseForm({
  path,
  method,
}: {
  path: string;
  method: string;
}) {
  const [statusCode, setStatusCode] = useState("");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 bg-secondary w-10 h-10 text-white"
        >
          <MdModeEdit />
        </Button>
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
                const res = await fetch(
                  `${import.meta.env.VITE_SERVER_URL}/set-response/${
                    location.pathname.split("/")[1]
                  }/${method}/${path}`,
                  {
                    method: "POST",
                    body: JSON.stringify({ statusCode, headers, body }),
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
