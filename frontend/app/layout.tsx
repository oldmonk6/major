"use client";

import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="logo">RECLAIM</div>
          <nav className="nav">
            <a href="/">Home</a>
            <a href="/auth">Auth</a>
            <a href="/onboard">Onboard</a>
            <a href="/tasks">Tasks</a>
            <a href="/checkin">Check-in</a>
            <a href="/coach">Coach</a>
            <a href="/risk">Risk</a>
            <a href="/journal">Journal</a>
            <a href="/progress">Progress</a>
            <a href="/sos">SOS</a>
            <a href="/logout">Logout</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
