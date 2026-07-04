import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  badge?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  badge,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          {breadcrumb.map((item, i) => (
            <span key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium" aria-current="page">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1 min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          {badge}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <div className="text-muted-foreground text-base max-w-2xl">{description}</div>
          )}
        </div>
        {actions && <div className="flex gap-3 flex-shrink-0 flex-wrap">{actions}</div>}
      </div>

      {toolbar && <div className="pt-1">{toolbar}</div>}
    </header>
  );
}
