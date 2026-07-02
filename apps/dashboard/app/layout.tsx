import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kash AI OS",
  description: "Command center for the Kash Intelligence Platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
