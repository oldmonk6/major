"use client";

import "./globals.css";
import React, { useEffect, useState } from "react";

export const metadata = {
  title: 'RECLAIM - Recovery Support Platform',
  description: 'Your personalized addiction recovery companion with AI coaching and daily support.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('reclaim_token');
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <html lang="en">
        <body style={{ background: 'var(--bg-primary)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            color: 'var(--text-primary)',
          }}>
            <div className="loading-spinner" />
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" style={{ textDecoration: 'none' }}>
            <div className="logo">RECLAIM</div>
          </a>
          {isAuthenticated && (
            <nav className="nav">
              <a href="/tasks">Tasks</a>
              <a href="/checkin">Check-in</a>
              <a href="/coach">Coach</a>
              <a href="/risk">Risk</a>
              <a href="/journal">Journal</a>
              <a href="/progress">Progress</a>
              <a href="/sos">SOS</a>
              <a href="/logout">Logout</a>
            </nav>
          )}
          {!isAuthenticated && (
            <nav className="nav">
              <a href="/">Home</a>
              <a href="/auth">Sign In</a>
            </nav>
          )}
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
