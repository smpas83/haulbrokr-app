import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SectionFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function SectionFade({ children, className, delay = 0 }: SectionFadeProps) {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn(!reduced && "section-fade", className)}
      style={!reduced && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
