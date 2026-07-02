import React, { type ReactNode } from "react";
import { Shell, ShellContent, ShellMain } from "./primitives";

export function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <ShellMain>
        <ShellContent>{children}</ShellContent>
      </ShellMain>
    </Shell>
  );
}
