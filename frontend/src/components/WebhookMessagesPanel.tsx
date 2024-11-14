import React, { useEffect } from "react";
import { ResizablePanel } from "./ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RiDeleteBin6Line } from "react-icons/ri";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router";
import { useMessages } from "@/providers/MessagesProvider";
import { toast } from "sonner";

export interface WebhookMessage {
  headers: Record<string, string>;
  body: Record<string, any>;
  host: string;
  path: string;
  method: string;
  time: string;
  id: string;
  protocol: string;
  queryParams: Record<string, string>;
}

interface MessageComponentProps {
  message: WebhookMessage;
  setMessages: React.Dispatch<React.SetStateAction<WebhookMessage[]>>;
}

export const methodColors: { [key: string]: string } = {
  GET: "#5bc0de",
  POST: "#5cb85c",
  PUT: "#f0ad4e",
  PATCH: "#607b59",
  DELETE: "#a71b17",
  HEAD: "#1f5b8f",
  OPTIONS: "#777",
};

export default function WebhookMessagesPanel() {
  //   const [messages, setMessages] = useState<WebhookMessage[]>([]);
  const { messages, setMessages } = useMessages();
  const location = useLocation();

  useEffect(() => {
    const savedMessages = localStorage.getItem("messages");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, [location]);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://${import.meta.env.VITE_SERVER_URL}/${
        location.pathname.split("/")[1]
      }`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prevMessages) => {
        const newMessages = [data, ...prevMessages];
        localStorage.setItem("messages", JSON.stringify(newMessages));
        return newMessages;
      });

      toast("New Message", {
        description: `${data.protocol}://${data.host}/${data.path}`,
        style: {
          background: "#181818",
        },
      });
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, [location.pathname, setMessages]);

  return (
    <ResizablePanel defaultSize={20} minSize={20}>
      <div className="overflow-y-auto max-h-[calc(100vh-4rem)]">
        {messages.map((message) => {
          return (
            <MessageBlock
              key={message.id}
              message={message}
              setMessages={setMessages}
            />
          );
        })}
      </div>
    </ResizablePanel>
  );
}

const MessageBlock: React.FC<MessageComponentProps> = ({ message }) => {
  const navigate = useNavigate();
  const { setMessages } = useMessages();
  const location = useLocation().pathname.split("/");

  const handleOnClick = () => {
    navigate(`/${location[1]}/${message.id}`);
  };

  const removeMessageById = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    e.stopPropagation();
    setMessages((prevMessages) => {
      const updatedMessages = prevMessages.filter(
        (message) => message.id !== id
      );

      if (updatedMessages.length === 0) {
        navigate(`/${location[1]}/`);
      }
      localStorage.setItem("messages", JSON.stringify(updatedMessages));

      if (location[2]?.startsWith(id)) {
        navigate(`/${location[1]}/`);
      }
      return updatedMessages;
    });
  };

  return (
    <div
      className="min-h-[5rem] p-4 hover:bg-[#181818] flex gap-4 items-center justify-between border-t-gray-700 border-t-2 transition-colors duration-150 cursor-pointer"
      onClick={handleOnClick}
    >
      <div className="flex flex-col gap-2 flex-grow max-w-[85%]">
        <div className="flex items-center gap-4">
          <div
            style={{
              backgroundColor: methodColors[message.method],
            }}
            className={`px-2 py-1 rounded-sm`}
          >
            {message.method}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-grow truncate text-ellipsis overflow-hidden whitespace-nowrap font-light">
                  /{message.path}
                </span>
              </TooltipTrigger>
              <TooltipContent className="bg-black text-foreground border-gray-600 py-3 px-4">
                <p>/{message.path}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-foregroundDarker flex flex-col gap-1">
          <span>
            {new Date(message.time).toTimeString().split(" ")[0]} | ID:{" "}
            {message.id.slice(0, 8)}
          </span>
        </div>
      </div>
      <Button
        className="transition-colors duration-150 aspect-square w-10 h-10 bg-red-700 hover:bg-red-800"
        onClick={(e) => removeMessageById(e, message.id)}
      >
        <RiDeleteBin6Line />
      </Button>
    </div>
  );
};
