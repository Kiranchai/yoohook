import React from "react";
import { useNavigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { RiDeleteBin6Line } from "react-icons/ri";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMessages } from "@/providers/MessagesProvider";
import { WebhookMessage, methodColors } from "@/types/webhook";

interface WebhookMessageBlockProps {
  message: WebhookMessage;
  isSelected?: boolean;
}

export const WebhookMessageBlock: React.FC<WebhookMessageBlockProps> = ({
  message,
  isSelected = false,
}) => {
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
      className={`min-h-[5rem] p-4 hover:bg-[#181818] flex gap-4 items-center justify-between border-t-gray-700 border-t-2 transition-colors duration-150 cursor-pointer ${
        isSelected ? "bg-[#181818]" : ""
      }`}
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
