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
import { useEffect, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { useMessages } from "@/providers/MessagesProvider";
import { methodColors } from "./WebhookMessagesPanel";
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

  useEffect(() => {
    const paths = getUniquePathMethodCombinations(messages);
    setUniquePaths(paths);
  }, [messages]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="hover:bg-secondary">
          Set custom response <IoIosSettings />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Set custom responses</DialogTitle>
          <DialogDescription>Detected endpoints:</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[250px] w-full border p-4">
          {uniquePaths.map((path, idx) => {
            return (
              <div
                className="py-2 border-b-2 border-b-gray-900 flex items-center gap-2 group justify-between"
                key={idx}
              >
                <div className="flex items-center gap-4">
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
                        <span className="max-w-[390px] w-full truncate text-ellipsis overflow-hidden whitespace-nowrap">
                          /{path.path}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black text-foreground border-gray-600 py-3 px-4">
                        <p>/{path.path}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CustomResponseForm
                  path={path.path}
                  method={path.method}
                  disabledUrl
                  newButton={false}
                />
              </div>
            );
          })}
        </ScrollArea>

        <CustomResponseForm
          path={""}
          method={"GET"}
          disabledUrl={false}
          newButton
        />
      </DialogContent>
    </Dialog>
  );
}
