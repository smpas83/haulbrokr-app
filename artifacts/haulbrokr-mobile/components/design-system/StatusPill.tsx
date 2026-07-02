import React from "react";
import { statusColor } from "@workspace/design-tokens";
import { Badge } from "./Badge";

export interface StatusPillProps {
  status: keyof typeof statusColor | string;
}

export function StatusPill({ status }: StatusPillProps) {
  const color = statusColor[status as keyof typeof statusColor] ?? statusColor.completed;
  return <Badge label={status.replace(/_/g, " ")} color={color} />;
}
