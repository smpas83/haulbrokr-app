import {
  Card as ShadcnCard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export type CardProps = ComponentProps<typeof ShadcnCard>;

export function Card({ className, ...props }: CardProps) {
  return <ShadcnCard className={cn(className)} {...props} />;
}

export { CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
