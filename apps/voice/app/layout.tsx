import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIP Voice",
  description: "Company-aware voice assistant for KIP."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
