import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type PageEmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PageEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: PageEmptyStateProps) {
  return (
    <Empty className={cn("border-2 border-dashed border-border", className)}>
      <EmptyHeader>
        {icon ? <EmptyMedia>{icon}</EmptyMedia> : null}
        <EmptyTitle className="font-bold">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
