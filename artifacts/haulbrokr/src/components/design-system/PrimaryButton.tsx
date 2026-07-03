import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PrimaryButtonProps = ButtonProps;

export function PrimaryButton({ className, ...props }: PrimaryButtonProps) {
  return <Button variant="default" className={cn(className)} {...props} />;
}
