"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type CoachSession = {
  id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type CoachMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  ts?: string | null;
};

export default function CoachPage() {
  const [token, setToken] = useState("");
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (!stored) {
      window.location.href = "/auth";
      return;
    }
    setToken(stored);
  }, []);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadSessions(token);
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  async function loadSessions(activeToken: string) {
    setLoadingSessions(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/coach/sessions`, {
        headers: getAuthHeaders(activeToken),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load sessions");
        return;
      }
      const loaded = (data.sessions || []) as CoachSession[];
      setSessions(loaded);
      if (loaded.length > 0) {
        await openSession(activeToken, loaded[0].id);
      } else {
        setActiveSessionId("");
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }

  async function createSession(activeToken: string, title = "New chat"): Promise<CoachSession | null> {
    try {
      const res = await fetch(`${apiBase}/coach/sessions`, {
        method: "POST",
        headers: getAuthHeaders(activeToken),
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to create session");
        return null;
      }
      const created = data as CoachSession;
      setSessions((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error(err);
      setError("Failed to create session");
      return null;
    }
  }

  async function openSession(activeToken: string, sessionId: string) {
    setLoadingMessages(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/coach/sessions/${sessionId}`, {
        headers: getAuthHeaders(activeToken),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load messages");
        return;
      }
      setActiveSessionId(sessionId);
      setMessages((data.messages || []) as CoachMessage[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function startNewChat() {
    if (!token) return;
    const created = await createSession(token, "New chat");
    if (!created) return;
    setActiveSessionId(created.id);
    setMessages([]);
    setDraft("");
  }

  async function sendMessage() {
    if (!token || sending) return;
    const text = draft.trim();
    if (!text) return;
    setError("");
    setSending(true);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await createSession(token, "New chat");
        if (!created) return;
        sessionId = created.id;
        setActiveSessionId(created.id);
      }

      const optimistic: CoachMessage = {
        id: `tmp-${Date.now()}`,
        session_id: sessionId,
        role: "user",
        content: text,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");

      const res = await fetch(`${apiBase}/coach/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(data.detail || "Failed to send message");
        return;
      }

      const userMsg = data.user_message as CoachMessage;
      const assistantMsg = data.assistant_message as CoachMessage;
      const updatedSession = data.session as CoachSession;

      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), userMsg, assistantMsg]);
      setSessions((prev) => {
        const others = prev.filter((s) => s.id !== updatedSession.id);
        return [updatedSession, ...others];
      });
    } catch (err) {
      console.error(err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "280px 1fr",
        gap: "1rem",
        minHeight: "70vh",
      }}
    >
      <Card style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Button onClick={startNewChat} style={{ width: "100%", justifyContent: "center" }}>
          + New Chat
        </Button>
        <div style={{ overflowY: "auto", display: "grid", gap: "0.5rem" }}>
          {loadingSessions && <div style={{ color: "var(--text-tertiary)" }}>Loading sessions...</div>}
          {!loadingSessions && sessions.length === 0 && (
            <div style={{ color: "var(--text-tertiary)", fontSize: "0.95rem" }}>
              No sessions yet. Start a new chat.
            </div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => void openSession(token, s.id)}
              style={{
                textAlign: "left",
                width: "100%",
                border: s.id === activeSessionId ? "1px solid var(--primary)" : "1px solid var(--border)",
                background: s.id === activeSessionId ? "rgba(6, 182, 212, 0.12)" : "var(--bg-secondary)",
                color: "var(--text-primary)",
                borderRadius: "0.5rem",
                padding: "0.7rem",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.title || "New chat"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                {s.updated_at ? new Date(s.updated_at).toLocaleString() : ""}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", minHeight: "70vh", padding: 0 }}>
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
          {activeSession ? activeSession.title : "AI Coach"}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "grid", gap: "0.75rem" }}>
          {loadingMessages && <div style={{ color: "var(--text-tertiary)" }}>Loading conversation...</div>}
          {!loadingMessages && messages.length === 0 && (
            <div style={{ color: "var(--text-tertiary)" }}>
              Start a conversation with your AI coach. Ask anything about urges, triggers, routines, or setbacks.
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                justifySelf: m.role === "user" ? "end" : "start",
                maxWidth: "80%",
                background: m.role === "user" ? "var(--primary)" : "var(--bg-secondary)",
                color: m.role === "user" ? "white" : "var(--text-primary)",
                border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                borderRadius: "0.8rem",
                padding: "0.75rem 0.9rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div
              style={{
                justifySelf: "start",
                maxWidth: "80%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-tertiary)",
                borderRadius: "0.8rem",
                padding: "0.75rem 0.9rem",
              }}
            >
              Thinking...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem", display: "grid", gap: "0.6rem" }}>
          {error && (
            <div style={{ color: "var(--error)", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.5)", borderRadius: "0.5rem", padding: "0.5rem 0.65rem" }}>
              {error}
            </div>
          )}
          <textarea
            className="textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message your coach..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={sending}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => void sendMessage()} disabled={sending || !draft.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
