import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IconButtonProps = ButtonProps;

export function IconButton({ className, size = "icon", ...props }: IconButtonProps) {
  return <Button variant="ghost" size={size} className={cn(className)} {...props} />;
}
