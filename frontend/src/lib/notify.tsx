import { toast } from "sonner";
import ToastNotification, { NotificationKind } from "@/components/ToastNotification";

export function notify({
  kind = "info",
  title,
  subtitle,
  caption,
  mono = false,
}: {
  kind?: NotificationKind;
  title: string;
  subtitle?: string;
  caption?: string;
  /** Render the subtitle in Plex Mono (paths, IDs). */
  mono?: boolean;
}) {
  toast.custom(
    (id) => (
      <ToastNotification kind={kind} title={title} subtitle={subtitle} caption={caption} mono={mono} onClose={() => toast.dismiss(id)} />
    ),
    { duration: 4000 },
  );
}
