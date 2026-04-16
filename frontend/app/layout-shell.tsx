"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import AnimatedCursor from "@/components/animated-cursor";
import { socialFetch } from "@/lib/social-api";
import { getSocialSocket, refreshSocketAuth } from "@/lib/social-socket";

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    const savedSidebar = localStorage.getItem("reclaim_sidebar_open");
    setIsAuthenticated(Boolean(token));
    if (savedSidebar === "false") setSidebarOpen(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("reclaim_sidebar_open", String(sidebarOpen));
  }, [sidebarOpen, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function loadUnread() {
      try {
        const data = await socialFetch<{ count: number }>("/social/messages/unread-count");
        if (!cancelled) setUnreadCount(data.count || 0);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    }

    void loadUnread();
    refreshSocketAuth();
    const socket = getSocialSocket();

    const onNewDM = (message: { senderId?: string }) => {
      const myId = localStorage.getItem("reclaim_user_id");
      if (pathname.startsWith("/messages")) return;
      if (message.senderId && message.senderId !== myId) setUnreadCount((prev) => prev + 1);
    };
    const onRead = () => {
      if (pathname.startsWith("/messages")) {
        void loadUnread();
      }
    };

    socket.on("new_dm", onNewDM);
    socket.on("message_read", onRead);
    return () => {
      cancelled = true;
      socket.off("new_dm", onNewDM);
      socket.off("message_read", onRead);
    };
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/messages")) return;
    setUnreadCount(0);
  }, [pathname]);

  if (isLoading) {
    return (
      <div style={{ background: "var(--bg-primary)" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "var(--text-primary)" }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (pathname === "/" || !isAuthenticated) {
    return (
      <>
        <AnimatedCursor />
        <main className="container page-scroll">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.32, ease: "easeOut" }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </>
    );
  }

  const navItems = [
    { href: "/tasks", label: "Today" },
    { href: "/social", label: "Explore" },
    { href: "/communities", label: "Communities" },
    { href: "/messages", label: "Messages", badge: unreadCount > 0 ? String(unreadCount) : "" },
    { href: "/settings/profile", label: "Profile" },
    { href: "/coach", label: "Coach" },
    { href: "/logout", label: "Logout" },
  ];

  return (
    <div className="app-shell">
      <AnimatedCursor />
      <aside className={`app-sidebar hide-scrollbar${sidebarOpen ? " app-sidebar-open" : " app-sidebar-hidden"}`}>
        <a href="/social" style={{ textDecoration: "none" }}>
          <div className="logo" style={{ marginBottom: "1.2rem" }}>RECLAIM SOCIAL</div>
        </a>
        <nav className="app-nav social-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <a key={item.href} href={item.href} className={isActive ? "active" : ""}>
                <span>{item.label}</span>
                {!!item.badge && <strong className="nav-badge">{item.badge}</strong>}
              </a>
            );
          })}
        </nav>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <main className="app-main app-main-full page-scroll">
        <button onClick={() => setSidebarOpen((prev) => !prev)} aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"} className="sidebar-toggle">
          {sidebarOpen ? "X" : "="}
        </button>
        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: "easeOut" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
