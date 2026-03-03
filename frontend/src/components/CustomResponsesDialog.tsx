import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IoIosSettings } from "react-icons/io";
import { RiDeleteBin6Line } from "react-icons/ri";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ScrollArea } from "./ui/scroll-area";
import { useMessages } from "@/providers/MessagesProvider";
import { methodColors } from "@/types/webhook";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import CustomResponseForm from "./CustomResponseForm";

const getUniquePathMethodCombinations = (
  messages: Array<{ path: string; method: string }>
): { path: string; method: string }[] => {
  const uniqueCombinations = Array.from(
    new Set(messages.map((msg) => `${msg.method}:${msg.path}`))
  ).map((key) => {
    const [method, ...pathParts] = key.split(":");
    return { method, path: pathParts.join(":") };
  });

  return uniqueCombinations;
};

interface PathMethod {
  path: string;
  method: string;
}

export default function CustomResponsesDialog() {
  const { messages } = useMessages();
  const [uniquePaths, setUniquePaths] = useState<PathMethod[]>([]);
  const [savedResponses, setSavedResponses] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const webhookId = location.pathname.split("/")[1];

  const loadSavedResponses = () => {
    const stored = localStorage.getItem("customResponses");
    setSavedResponses(stored ? JSON.parse(stored) : []);
  };

  useEffect(() => {
    const paths = getUniquePathMethodCombinations(messages);
    setUniquePaths(paths);
  }, [messages]);

  useEffect(() => {
    if (isOpen) loadSavedResponses();
  }, [isOpen]);

  const hasCustomResponse = (method: string, endpoint: string): boolean => {
    return savedResponses.some(
      (r) => r.method === method && r.endpoint === endpoint,
    );
  };

  const deleteCustomResponse = async (method: string, endpoint: string) => {
    try {
      await fetch(
        `${import.meta.env.VITE_SERVER_URL}/delete-response/${webhookId}/${method}${endpoint}`,
        { method: "DELETE" },
      );
    } catch {}

    const updated = savedResponses.filter(
      (r) => !(r.method === method && r.endpoint === endpoint),
    );
    localStorage.setItem("customResponses", JSON.stringify(updated));
    setSavedResponses(updated);
    toast("Custom response deleted", {
      description: `${method} ${endpoint}`,
      style: { background: "#181818" },
    });
  };

  const clearAllCustomResponses = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_SERVER_URL}/delete-responses/${webhookId}`,
        { method: "DELETE" },
      );
    } catch {}

    localStorage.setItem("customResponses", JSON.stringify([]));
    setSavedResponses([]);
    toast("All custom responses cleared", {
      style: { background: "#181818" },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="hover:bg-secondary">
          Set custom response <IoIosSettings />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[600px] w-full">
        <DialogHeader>
          <DialogTitle>Set custom responses</DialogTitle>
          <DialogDescription>Detected endpoints:</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[250px] w-full border p-4">
          {uniquePaths.map((path) => {
            const endpoint = "/" + path.path;
            const hasSaved = hasCustomResponse(path.method, endpoint);
            return (
              <div
                className="py-2 border-b-2 border-b-gray-900 flex items-center gap-2 group justify-between"
                key={`${path.method}:${path.path}`}
              >
                <div className="flex items-center gap-4">
                  {hasSaved && (
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  )}
                  <div
                    style={{
                      backgroundColor: methodColors[path.method],
                    }}
                    className={`px-2 py-1 rounded-md text-center`}
                  >
                    {path.method}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="max-w-[330px] w-full truncate text-ellipsis overflow-hidden whitespace-nowrap">
                          /{path.path}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black text-foreground border-gray-600 py-3 px-4">
                        <p>/{path.path}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-1">
                  {hasSaved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-red-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                      onClick={() =>
                        deleteCustomResponse(path.method, endpoint)
                      }
                    >
                      <RiDeleteBin6Line />
                    </Button>
                  )}
                  <CustomResponseForm
                    path={endpoint}
                    method={path.method}
                    disabledUrl
                    newButton={false}
                  />
                </div>
              </div>
            );
          })}
        </ScrollArea>

        <div className="flex items-center justify-between">
          <CustomResponseForm
            path={"/"}
            method={"GET"}
            disabledUrl={false}
            newButton
          />
          {savedResponses.length > 0 && (
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
              onClick={clearAllCustomResponses}
            >
              Clear all responses
              <RiDeleteBin6Line />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
