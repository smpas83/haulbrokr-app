import React, { type ReactNode } from "react";
import { Stack } from "expo-router";

export function CustomerDashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function CustomerDashboardNavigator() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
