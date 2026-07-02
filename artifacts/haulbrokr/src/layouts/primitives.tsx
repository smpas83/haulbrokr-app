import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Shell({ children, className, ...props }: ShellProps) {
  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)} {...props}>
      {children}
    </div>
  );
}

export interface ShellHeaderProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function ShellHeader({ children, className, ...props }: ShellHeaderProps) {
  return (
    <header className={cn("border-b border-border bg-background", className)} {...props}>
      {children}
    </header>
  );
}

export interface ShellMainProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function ShellMain({ children, className, ...props }: ShellMainProps) {
  return (
    <main className={cn("flex-1", className)} {...props}>
      {children}
    </main>
  );
}

export interface ShellSidebarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function ShellSidebar({ children, className, ...props }: ShellSidebarProps) {
  return (
    <aside className={cn("border-r border-sidebar-border bg-sidebar", className)} {...props}>
      {children}
    </aside>
  );
}

export interface ShellContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ShellContent({ children, className, ...props }: ShellContentProps) {
  return (
    <div className={cn("p-4 md:p-8", className)} {...props}>
      {children}
    </div>
  );
}
