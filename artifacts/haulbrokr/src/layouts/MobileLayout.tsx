import type { ReactNode } from "react";
import { Shell, ShellContent, ShellMain } from "./primitives";

export function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <Shell className="pb-20">
      <ShellMain>
        <ShellContent className="p-4">{children}</ShellContent>
      </ShellMain>
    </Shell>
  );
}
