import { useNavigate, useParams } from "react-router";
import Dashboard from "./components/Dashboard";
import { useEffect, useState } from "react";
import { FaRegCopy } from "react-icons/fa";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "./components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import logo from "@/assets/logo.png";
import Lottie from "react-lottie";
import animationData from "./lotties/listening.json";
import { useMessages } from "./providers/MessagesProvider";
import { GiPerspectiveDiceSixFacesRandom } from "react-icons/gi";
import CustomResponsesDialog from "./components/CustomResponsesDialog";

function App() {
  const { webhookId, messageId } = useParams();
  const navigate = useNavigate();
  const [generatedWebhookId, setGeneratedWebhookId] = useState<string | null>(
    ""
  );
  const { messages, setMessages } = useMessages();

  useEffect(() => {
    setMessages(JSON.parse(localStorage.getItem("messages") || "[]"));
  }, [localStorage]);

  useEffect(() => {
    if (generatedWebhookId) {
      navigate(`/${generatedWebhookId}/${messageId ? messageId : ""}`);
      localStorage.setItem("webhookId", generatedWebhookId);
    }
  }, [generatedWebhookId]);

  useEffect(() => {
    const savedWebhookId = localStorage.getItem("webhookId");

    if (!webhookId && !savedWebhookId) {
      setGeneratedWebhookId(crypto.randomUUID());
    } else {
      setGeneratedWebhookId(webhookId || savedWebhookId);
    }
  }, [webhookId]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(
      `${import.meta.env.VITE_SERVER_URL}/${generatedWebhookId}`
    );

    toast("Copied to clipboard", {
      description: `${import.meta.env.VITE_SERVER_URL}/${generatedWebhookId}`,
      style: {
        background: "#181818",
      },
    });
  };

  const handleGenerateNewWebhookId = () => {
    setGeneratedWebhookId(crypto.randomUUID());
    localStorage.setItem("messages", JSON.stringify([]));
    setMessages([]);
    navigate(`/${generatedWebhookId}/`);
  };

  return (
    <div className="bg-primary text-foreground">
      <nav className="bg-navBg min-h-[6rem] flex items-center gap-10 justify-between px-8">
        <img src={logo} className="object-contain max-h-[3rem] px-4" />
        <div className="flex gap-2 items-center">
          <span>Your hook:</span>
          <span
            className="bg-primary px-3 py-2 rounded-sm flex items-center gap-2 hover:bg-[#454b53] cursor-pointer transition-colors duration-150"
            onClick={handleCopyToClipboard}
          >
            {import.meta.env.VITE_SERVER_URL}/{generatedWebhookId}
            <FaRegCopy />
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex items-center">
                Generate new webhook <GiPerspectiveDiceSixFacesRandom />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your saved messages.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateNewWebhookId}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <CustomResponsesDialog />
        </div>
      </nav>

      <Dashboard>
        {messages.length === 0 && (
          <>
            <div className="absolute top-0 left-0 bg-primary z-[10] ">
              <div className="opacity-50 flex justify-center items-center w-[100vw]">
                <Lottie
                  width="60vw"
                  height={"94vh"}
                  options={{
                    loop: true,
                    autoplay: true,
                    animationData: animationData,
                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                  }}
                  isClickToPauseDisabled
                />
              </div>
            </div>
          </>
        )}
      </Dashboard>
      <Toaster />
    </div>
  );
}

export default App;
