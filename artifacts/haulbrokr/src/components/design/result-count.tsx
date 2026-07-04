import { cn } from "@/lib/utils";

interface ResultCountProps {
  count: number;
  total?: number;
  noun?: string;
  className?: string;
}

/** Accessible result count for filtered lists */
export function ResultCount({
  count,
  total,
  noun = "result",
  className,
}: ResultCountProps) {
  const label =
    total != null && total !== count
      ? `${count} of ${total} ${noun}${count === 1 ? "" : "s"}`
      : `${count} ${noun}${count === 1 ? "" : "s"}`;

  return (
    <p
      className={cn("text-xs font-medium text-muted-foreground", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </p>
  );
}
