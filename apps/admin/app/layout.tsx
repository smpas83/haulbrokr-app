import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIP Admin",
  description: "Workspace governance and enterprise administration for KIP."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
