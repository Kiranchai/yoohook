import * as Dialog from "@radix-ui/react-dialog";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

type Action = {
  label: string;
  onClick: () => void;
  kind?: "primary" | "danger";
  disabled?: boolean;
};

/**
 * Carbon modal: square panel on layer-01, label + title header, close button,
 * and a 64px footer of full-bleed buttons.
 */
export function Modal({
  open,
  onOpenChange,
  label,
  title,
  description,
  children,
  primary,
  secondaryLabel = "Cancel",
  className,
  bodyClassName,
  footerSpacer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  primary: Action;
  secondaryLabel?: string;
  className?: string;
  bodyClassName?: string;
  /** Leave the left half of the footer empty (Carbon large modal pattern). */
  footerSpacer?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content
          className={cn(
            "modal fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[512px] flex-col bg-layer-1 text-text-primary focus:outline-none",
            className,
          )}
          // `translate` centres the panel; `transform` stays free for the enter/exit motion.
          style={{ translate: "-50% -50%" }}
        >
          <div className="pl-4 pr-16 pt-4">
            {label && <span className="label-01">{label}</span>}
            <Dialog.Title className="mt-1 text-xl font-normal leading-7">{title}</Dialog.Title>
          </div>
          <Dialog.Close
            aria-label="Close"
            className="btn btn-ghost absolute right-0 top-0 grid h-12 w-12 place-items-center"
          >
            <Icon name="close" size={20} />
          </Dialog.Close>
          <div className={cn("flex min-h-0 flex-1 flex-col gap-4 px-4 pb-12 pt-4", bodyClassName)}>
            {description && (
              <Dialog.Description className="text-body text-text-primary">{description}</Dialog.Description>
            )}
            {children}
          </div>
          <div className={cn("grid h-16 shrink-0", footerSpacer ? "grid-cols-4" : "grid-cols-2")}>
            {footerSpacer && <span className="col-span-2 border-t border-border-subtle" />}
            <Dialog.Close className="btn btn-secondary items-start px-4 pb-[30px] pt-[14px] text-left">
              {secondaryLabel}
            </Dialog.Close>
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              className={cn(
                "btn items-start px-4 pb-[30px] pt-[14px] text-left",
                primary.kind === "danger" ? "btn-danger" : "btn-primary",
              )}
            >
              {primary.label}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
