import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-4 section-fade", className)}>
      <div className="space-y-1">
        {badge}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <div className="text-muted-foreground text-base max-w-2xl">{description}</div>
        )}
      </div>
      {actions && <div className="flex gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}
