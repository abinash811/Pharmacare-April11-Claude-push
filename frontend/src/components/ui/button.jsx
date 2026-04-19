import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

// PharmaCare design system — Button variants
// Default matches raw `<button className="bg-brand text-white ...">` exactly:
//   rounded-lg (8px), font-semibold, no shadow, hover:bg-brand-dark
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white hover:bg-brand-dark",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
        secondary:
          "bg-gray-100 text-gray-700 hover:bg-gray-200",
        ghost: "hover:bg-gray-100 text-gray-600",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Button — base Shadcn button with PharmaCare design tokens applied.
 *
 * Extra props beyond standard Shadcn:
 *   shortcut {string}  — keyboard shortcut badge shown on the right (e.g. "N", "⌘K")
 *
 * Usage:
 *   <Button shortcut="N">New Bill</Button>
 *   <Button variant="outline" shortcut="⌘K">Search</Button>
 */
const Button = React.forwardRef(({ className, variant, size, asChild = false, shortcut, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {children}
      {shortcut && (
        <kbd className="ml-1 inline-flex h-5 items-center rounded border border-current/20 bg-current/10 px-1.5 font-mono text-[10px] font-medium opacity-70">
          {shortcut}
        </kbd>
      )}
    </Comp>
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
