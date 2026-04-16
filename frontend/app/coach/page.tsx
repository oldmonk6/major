"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

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

type StreamDonePayload = {
  session: CoachSession;
  assistant_message: CoachMessage;
};

type RecoverySummary = {
  cravings_logged: number;
  cravings_resisted: number;
  slips_logged: number;
  patterns?: {
    top_trigger: string;
    top_time_window: string;
  };
};

type EmergencyPlan = {
  replacement_actions?: string[];
  reasons_to_quit?: string[];
};

function parseSSEBlock(block: string): { event: string; data: string } | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (!dataLines.length) return null;
  return {
    event: eventLine ? eventLine.slice(6).trim() : "message",
    data: dataLines.map((line) => line.slice(5).trim()).join("\n"),
  };
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
};

const drawerVariants: Variants = {
  hidden: { x: "-104%" },
  visible: {
    x: 0,
    transition: { type: "spring", stiffness: 340, damping: 34, mass: 0.9 },
  },
};

const composerVariants: Variants = {
  idle: { y: 0, scale: 1 },
  sending: {
    y: -2,
    scale: 1.003,
    transition: { type: "spring", stiffness: 320, damping: 24 },
  },
};

export default function CoachPage() {
  const [token, setToken] = useState("");

  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState("");
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [plan, setPlan] = useState<EmergencyPlan | null>(null);

  const [isNarrow, setIsNarrow] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

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
    const check = () => {
      const narrow = window.innerWidth < 960;
      setIsNarrow(narrow);
      setShowSidebar(!narrow);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadSessions(token);
    void loadRecoveryContext(token);
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const promptSuggestions = [
    "Help me plan for my hardest trigger today.",
    "Give me a 10-minute recovery reset.",
    "Help me make a plan for the next high-risk window.",
  ];

  async function loadRecoveryContext(activeToken: string) {
    try {
      const [summaryRes, planRes] = await Promise.all([
        fetch(`${apiBase}/progress/summary`, { headers: getAuthHeaders(activeToken) }),
        fetch(`${apiBase}/emergency-plan`, { headers: getAuthHeaders(activeToken) }),
      ]);
      const summaryData = await summaryRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);
      if (summaryRes.ok) setSummary(summaryData);
      if (planRes.ok) setPlan(planData.plan || null);
    } catch (err) {
      console.error(err);
    }
  }

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
      if (isNarrow) setShowSidebar(false);
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
    if (isNarrow) setShowSidebar(false);
  }

  async function deleteSession(sessionId: string) {
    if (!token || deletingSessionId) return;
    setDeletingSessionId(sessionId);
    setError("");
    try {
      const res = await fetch(`${apiBase}/coach/sessions/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to delete chat");
        return;
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId("");
        setMessages([]);
      }
      await loadSessions(token);
    } catch (err) {
      console.error(err);
      setError("Failed to delete chat");
    } finally {
      setDeletingSessionId("");
    }
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

      const optimisticUser: CoachMessage = {
        id: `tmp-user-${Date.now()}`,
        session_id: sessionId,
        role: "user",
        content: text,
        ts: new Date().toISOString(),
      };
      const tempAssistantId = `tmp-assistant-${Date.now()}`;
      const optimisticAssistant: CoachMessage = {
        id: tempAssistantId,
        session_id: sessionId,
        role: "assistant",
        content: "",
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
      setDraft("");

      const res = await fetch(`${apiBase}/coach/sessions/${sessionId}/messages/stream`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => prev.filter((message) => message.id !== tempAssistantId));
        setError(data.detail || "Failed to send message");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const parsed = parseSSEBlock(block);
          if (!parsed) continue;
          try {
            const payload = JSON.parse(parsed.data);
            if (parsed.event === "user") {
              const userMessage = payload as CoachMessage;
              setMessages((prev) =>
                prev.map((message) => (message.id === optimisticUser.id ? userMessage : message))
              );
            } else if (parsed.event === "delta") {
              const content = String(payload.content || "");
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId
                    ? { ...message, content: `${message.content}${content}` }
                    : message
                )
              );
            } else if (parsed.event === "done") {
              const donePayload = payload as StreamDonePayload;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === tempAssistantId ? donePayload.assistant_message : message
                )
              );
              setSessions((prev) => {
                const others = prev.filter((session) => session.id !== donePayload.session.id);
                return [donePayload.session, ...others];
              });
            }
          } catch (streamErr) {
            console.error("Failed to parse stream payload", streamErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function fillPrompt(text: string) {
    setDraft(text);
  }

  return (
    <div className="coach-shell">
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            key="drawer-backdrop"
            onClick={() => setShowSidebar(false)}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="coach-backdrop"
          />
        )}
      </AnimatePresence>

      <motion.div
        variants={drawerVariants}
        initial={false}
        animate={showSidebar ? "visible" : "hidden"}
        className="coach-drawer"
        style={{ width: isNarrow ? "min(320px, 90vw)" : "300px" }}
      >
        <aside className="hide-scrollbar coach-sidebar">
          <div className="coach-sidebar-top">
            <button onClick={startNewChat} className="coach-mark-button">
              R
            </button>
            <button onClick={startNewChat} className="coach-new-chat">
              + New coach chat
            </button>
          </div>
          <div className="coach-divider" />
          <div className="coach-side-label">Your chats</div>
          <div className="hide-scrollbar coach-chat-list">
            {loadingSessions && <div className="coach-side-note">Loading sessions...</div>}
            {!loadingSessions && sessions.length === 0 && (
              <div className="coach-side-note">No chats yet.</div>
            )}
            {sessions.map((session) => (
              <div key={session.id} className={`coach-chat-row${session.id === activeSessionId ? " active" : ""}`}>
                <button onClick={() => void openSession(token, session.id)} className="coach-chat-open">
                  {session.title || "New chat"}
                </button>
                <button
                  onClick={() => void deleteSession(session.id)}
                  disabled={deletingSessionId === session.id}
                  title="Delete chat"
                  aria-label="Delete chat"
                  className="coach-chat-delete"
                >
                  {deletingSessionId === session.id ? "..." : "x"}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </motion.div>

      <a
        href="/tasks"
        className="coach-toggle"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 80,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        Exit Coach
      </a>

      <section className="coach-stage">
        <header className="coach-header">
          <div className="coach-header-copy">
            <p className="journey-kicker">AI Coach</p>
            <div className="coach-title">{activeSession?.title || "Recovery conversation"}</div>
          </div>
          <div className="coach-header-actions">
            <a
              href="/tasks"
              className="coach-toggle"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Back to Tasks
            </a>
            <a
              href="/"
              className="coach-toggle"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Home
            </a>
            <button onClick={() => setShowSidebar((prev) => !prev)} className="coach-toggle">
              {showSidebar ? "Hide sidebar" : "Show sidebar"}
            </button>
          </div>
        </header>

        <div className="hide-scrollbar coach-scroll">
          <div className="coach-content">
            <div className="coach-context-band">
              <div className="coach-context-copy">
                <p className="journey-kicker">Coach Context</p>
                <h2>Talk inside your real recovery state.</h2>
                <p>
                  The coach uses your latest trigger pattern, recent slips, and emergency-plan cues so
                  the advice stays grounded.
                </p>
              </div>
              <div className="coach-context-grid">
                <div>
                  <span>Top trigger</span>
                  <strong>{summary?.patterns?.top_trigger || "Not enough data"}</strong>
                </div>
                <div>
                  <span>Hardest time</span>
                  <strong>{summary?.patterns?.top_time_window || "Not enough data"}</strong>
                </div>
                <div>
                  <span>Cravings resisted</span>
                  <strong>{summary?.cravings_resisted ?? 0}</strong>
                </div>
                <div>
                  <span>Slip logs</span>
                  <strong>{summary?.slips_logged ?? 0}</strong>
                </div>
              </div>
            </div>

            <div className="coach-prompt-row">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="coach-prompt-chip"
                  onClick={() => fillPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {!!(plan?.replacement_actions?.length || plan?.reasons_to_quit?.length) && (
              <div className="coach-plan-band">
                <div>
                  <p className="journey-kicker">Emergency Plan Cues</p>
                  <h3>Keep these active in the conversation.</h3>
                </div>
                <div className="coach-plan-list">
                  {(plan?.replacement_actions || []).slice(0, 2).map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                  {(plan?.reasons_to_quit || []).slice(0, 2).map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            )}

            {loadingMessages && <div className="coach-side-note">Loading conversation...</div>}
            {!loadingMessages && messages.length === 0 && (
              <div className="coach-empty-state">
                <p className="journey-kicker">Recovery Conversation</p>
                <h2>Use the coach for planning, de-escalation, and the next safe move.</h2>
                <p>Start with one concrete problem, trigger, or time window.</p>
              </div>
            )}

            <div className="coach-transcript">
              {messages.map((message) => (
                <div key={message.id} className={`coach-message ${message.role === "user" ? "user" : "assistant"}`}>
                  {message.content}
                  {sending && message.role === "assistant" && message.id.startsWith("tmp-assistant") && (
                    <span className="coach-thinking">Thinking...</span>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
        </div>

        <motion.div
          variants={composerVariants}
          initial={false}
          animate={sending ? "sending" : "idle"}
          className="coach-composer-wrap"
        >
          <motion.div layout className="coach-composer">
            {error && <div className="coach-error">{error}</div>}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask for a next-step plan, a craving reset, or help through a hard window."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              className="coach-composer-textarea"
            />
            <div className="coach-composer-row">
              <div className="coach-composer-note">{sending ? "Streaming response..." : "Press Enter to send"}</div>
              <button onClick={() => void sendMessage()} disabled={sending || !draft.trim()} className="coach-send">
                ^
              </button>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
