import "./globals.css";
import React from "react";
import type { Metadata, Viewport } from "next";
import ClientLayoutShell from "./layout-shell";

export const metadata: Metadata = {
  title: "RECLAIM - Recovery Support Platform",
  description: "Your personalized addiction recovery companion with AI coaching and daily support.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayoutShell>{children}</ClientLayoutShell>
      </body>
    </html>
  );
}
