import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function FadeIn({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-in fade-in duration-500", className)} {...props} />;
}

function SlideUp({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-in slide-in-from-bottom-2 duration-500", className)} {...props} />;
}

function HoverCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("transition-colors hover:border-primary/50", className)} {...props} />;
}

function PageTransition({ className, ...props }: ComponentProps<"div">) {
  return <FadeIn className={className} {...props} />;
}

function LoadingTransition({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-in fade-in duration-300", className)} {...props} />;
}

export { FadeIn, SlideUp, HoverCard, PageTransition, LoadingTransition };
