import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/80 shadow-sm shadow-primary/10 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border border-destructive/80 hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent shadow-sm hover:bg-muted/50 hover:border-primary/30",
        secondary:
          "border bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
        ghost: "border border-transparent hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline border-transparent",
        accent:
          "bg-accent text-accent-foreground border border-accent/80 shadow-sm shadow-accent/10 hover:bg-accent/90",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-12 rounded-lg px-8 text-base",
        xl: "min-h-14 rounded-xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
