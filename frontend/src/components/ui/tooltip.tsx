import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/** Carbon tooltip: inverse (light) surface, dark text, small caret. */
const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={16}
      className={cn(
        "tooltip z-50 max-w-[min(640px,calc(100vw-32px))] bg-inverse px-3 py-2 text-label text-text-inverse shadow-[0_2px_6px_rgba(0,0,0,0.3)]",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow width={10} height={5} className="fill-inverse" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
