import React, { type ReactNode } from "react";
import { Text } from "react-native";
import { Shell, ShellContent, ShellHeader, ShellMain } from "./primitives";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <ShellHeader>
        <Text style={{ fontWeight: "700", fontSize: 18 }}>HaulBrokr</Text>
      </ShellHeader>
      <ShellMain>
        <ShellContent>{children}</ShellContent>
      </ShellMain>
    </Shell>
  );
}
