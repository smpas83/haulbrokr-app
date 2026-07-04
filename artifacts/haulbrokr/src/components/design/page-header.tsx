import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
  /** Optional eyebrow text above the title */
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
  eyebrow,
}: PageHeaderProps) {
  const titleId = "page-title";

  return (
    <header
      className={cn(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4",
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="space-y-1 min-w-0">
        {badge}
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1
          id={titleId}
          className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
        >
          {title}
        </h1>
        {description && (
          <div className="text-muted-foreground text-base max-w-2xl leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div
          className="flex gap-3 flex-shrink-0 w-full md:w-auto"
          role="toolbar"
          aria-label="Page actions"
        >
          {actions}
        </div>
      )}
    </header>
  );
}
