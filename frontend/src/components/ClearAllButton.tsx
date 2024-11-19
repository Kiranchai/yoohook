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
import { TbTrashXFilled } from "react-icons/tb";
import { Button } from "./ui/button";
import { useMessages } from "@/providers/MessagesProvider";

export default function ClearAllButton() {
  const { clearMessages } = useMessages();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="bg-red-700 hover:bg-red-800 gap-2 flex items-center justify-center">
          <span>Remove all</span>
          <TbTrashXFilled className="translate-y-[-1px]" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            saved messages.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={clearMessages}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
