import { Card, type CardProps } from "./Card";
import { cn } from "@/lib/utils";

export type GlassCardProps = CardProps;

export function GlassCard({ className, ...props }: GlassCardProps) {
  return (
    <Card
      className={cn("bg-card/80 backdrop-blur-sm border-border/50", className)}
      {...props}
    />
  );
}
