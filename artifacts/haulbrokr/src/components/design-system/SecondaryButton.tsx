import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SecondaryButtonProps = ButtonProps;

export function SecondaryButton({ className, ...props }: SecondaryButtonProps) {
  return <Button variant="secondary" className={cn(className)} {...props} />;
}
