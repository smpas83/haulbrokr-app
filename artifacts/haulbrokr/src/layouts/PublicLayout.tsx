import type { ReactNode } from "react";
import { Shell, ShellContent, ShellHeader, ShellMain } from "./primitives";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <ShellHeader className="h-16 flex items-center px-6">
        <span className="font-bold text-lg text-primary">HaulBrokr</span>
      </ShellHeader>
      <ShellMain>{children}</ShellMain>
    </Shell>
  );
}
