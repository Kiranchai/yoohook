import { Toaster as Sonner } from "sonner";

/** Toasts are rendered by `notify()` as custom Carbon notifications. */
export function Toaster() {
  return <Sonner theme="dark" position="top-right" offset={64} gap={8} visibleToasts={4} />;
}
