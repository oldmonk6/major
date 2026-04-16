"use client";

import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  type ConversationListItem,
  type SocialMessage,
  socialFetch,
} from "@/lib/social-api";
import { getSocialSocket, refreshSocketAuth } from "@/lib/social-socket";

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId") || "";
  const threadRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const loadingOlderRef = useRef(false);

  const [myUserId, setMyUserId] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [typingUserId, setTypingUserId] = useState("");
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  const [oldestMessageId, setOldestMessageId] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const seenMessageId = useMemo(() => {
    if (!partnerReadAt) return "";
    const seen = [...messages]
      .reverse()
      .find((message) => message.senderId === myUserId && message.createdAt && new Date(message.createdAt).getTime() <= new Date(partnerReadAt).getTime());
    return seen?.id || "";
  }, [messages, myUserId, partnerReadAt]);

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    void bootstrap();
  }, [targetUserId]);

  useEffect(() => {
    refreshSocketAuth();
    const socket = getSocialSocket();

    const onNewDM = (message: SocialMessage) => {
      setConversations((prev) => {
        const next = [...prev];
        const index = next.findIndex((item) => item.id === message.conversationId);
        if (index === -1) return prev;
        const current = next[index];
        next[index] = {
          ...current,
          last_message: message.content || "Image attachment",
          last_message_at: message.createdAt,
          last_message_sender_id: message.senderId,
          unread_count: message.senderId !== myUserId && message.conversationId !== activeConversationId ? current.unread_count + 1 : current.unread_count,
        };
        const [moved] = next.splice(index, 1);
        next.unshift(moved);
        return next;
      });

      if (message.conversationId === activeConversationId) {
        setMessages((prev) => [...prev, message]);
        if (message.senderId !== myUserId) void markRead(message.conversationId || "");
        requestAnimationFrame(() => {
          const node = threadRef.current;
          if (node) node.scrollTop = node.scrollHeight;
        });
      }
    };

    const onTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId !== activeConversationId) return;
      setTypingUserId(payload.isTyping ? payload.userId : "");
    };

    const onRead = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId !== activeConversationId || payload.userId === myUserId) return;
      const ts = new Date().toISOString();
      setPartnerReadAt(ts);
      setMessages((prev) =>
        prev.map((message) =>
          message.senderId === myUserId
            ? { ...message, seen: true, seenAt: ts }
            : message
        )
      );
    };

    socket.on("new_dm", onNewDM);
    socket.on("typing", onTyping);
    socket.on("message_read", onRead);
    return () => {
      socket.off("new_dm", onNewDM);
      socket.off("typing", onTyping);
      socket.off("message_read", onRead);
    };
  }, [activeConversationId, myUserId]);

  async function bootstrap() {
    setLoading(true);
    setError("");
    try {
      const me = await socialFetch<{ id: string }>("/social/profile/me");
      setMyUserId(me.id);
      localStorage.setItem("reclaim_user_id", me.id);

      let targetConversationId = "";
      if (targetUserId) {
        const created = await socialFetch<{ conversation_id: string }>(`/social/conversations/with/${targetUserId}`, { method: "POST" });
        targetConversationId = created.conversation_id;
      }

      const list = await socialFetch<{ items: ConversationListItem[] }>("/social/conversations");
      setConversations(list.items || []);
      const firstConversationId = targetConversationId || list.items?.[0]?.id || "";
      if (firstConversationId) await openConversation(firstConversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    try {
      const data = await socialFetch<{ items: SocialMessage[]; partnerReadAt?: string | null }>(`/social/conversations/${conversationId}/messages?limit=50`);
      setMessages(data.items || []);
      setOldestMessageId(data.items?.[0]?.id || "");
      setHasMore((data.items || []).length >= 50);
      setPartnerReadAt(data.partnerReadAt || null);
      setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)));
      const socket = getSocialSocket();
      socket.emit("join_conversation", conversationId);
      await markRead(conversationId);
      requestAnimationFrame(() => {
        const node = threadRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open conversation");
    }
  }

  async function loadOlderMessages() {
    if (!activeConversationId || !oldestMessageId || !hasMore || loadingOlderRef.current) return;
    const node = threadRef.current;
    const previousHeight = node?.scrollHeight || 0;
    loadingOlderRef.current = true;
    try {
      const data = await socialFetch<{ items: SocialMessage[] }>(
        `/social/conversations/${activeConversationId}/messages?limit=50&before_id=${oldestMessageId}`
      );
      const older = data.items || [];
      if (!older.length) {
        setHasMore(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      setOldestMessageId(older[0].id);
      if (older.length < 50) setHasMore(false);
      requestAnimationFrame(() => {
        const current = threadRef.current;
        if (current) current.scrollTop = current.scrollHeight - previousHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load older messages");
    } finally {
      loadingOlderRef.current = false;
    }
  }

  async function sendMessage() {
    if (!activeConversationId || (!draft.trim() && !imageUrl.trim())) return;
    const socket = getSocialSocket();
    socket.emit("send_dm", {
      conversationId: activeConversationId,
      content: draft.trim(),
      imageUrl: imageUrl.trim() || undefined,
    });
    setDraft("");
    setImageUrl("");
    socket.emit("typing_stop", { conversationId: activeConversationId });
  }

  function emitTyping() {
    if (!activeConversationId) return;
    const socket = getSocialSocket();
    socket.emit("typing_start", { conversationId: activeConversationId });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing_stop", { conversationId: activeConversationId });
    }, 1200);
  }

  async function markRead(conversationId: string) {
    if (!conversationId) return;
    const socket = getSocialSocket();
    socket.emit("mark_read", { conversationId });
    await socialFetch(`/social/conversations/${conversationId}/read`, { method: "POST" }).catch(() => null);
  }

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading conversations...</div>;
  }

  return (
    <div className="mx-auto h-[calc(100vh-90px)] max-w-7xl p-4 md:p-6">
      {!!error && <div className="mb-3 rounded-2xl border border-[var(--error-dark)] bg-red-100 px-4 py-3 text-sm text-[var(--error-dark)]">{error}</div>}

      <div className="grid h-full overflow-hidden rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] md:grid-cols-[340px,1fr]">
        <aside className="border-r border-[var(--border)] bg-[var(--surface-elevated)] p-3">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Inbox</p>
            <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Direct messages</h1>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 190px)" }}>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className={`w-full rounded-2xl border p-3 text-left ${conversation.id === activeConversationId ? "border-[var(--primary-dark)] bg-[var(--surface)]" : "border-[var(--border)] bg-white/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{conversation.partner.display_name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">@{conversation.partner.username}</p>
                  </div>
                  {!!conversation.unread_count && <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>}
                </div>
                <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">{conversation.last_message || "No messages yet"}</p>
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString() : ""}</p>
              </button>
            ))}
            {!conversations.length && <p className="text-sm text-[var(--text-secondary)]">Open a user profile and start a conversation.</p>}
          </div>
        </aside>

        <main className="flex h-full flex-col">
          <header className="border-b border-[var(--border)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Active thread</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{activeConversation?.partner.display_name || "Select a conversation"}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{activeConversation ? `@${activeConversation.partner.username}` : "Pick a thread from the sidebar."}</p>
          </header>

          <div
            ref={threadRef}
            onScroll={() => {
              const node = threadRef.current;
              if (node && node.scrollTop < 120) void loadOlderMessages();
            }}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {hasMore && !!messages.length && <div className="mb-4 text-center text-xs text-[var(--text-tertiary)]">Scroll up to load earlier messages</div>}
            <div className="space-y-3">
              {messages.map((message) => {
                const mine = message.senderId === myUserId;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-[1.35rem] px-4 py-3 ${mine ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"}`}>
                      {!mine && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">{message.senderDisplayName}</p>}
                      {!!message.content && <p className="text-sm">{message.content}</p>}
                      {!!message.imageUrl && <img src={message.imageUrl} alt="" className="mt-2 max-h-72 rounded-xl object-cover" />}
                      <p className={`mt-2 text-[11px] ${mine ? "text-white/70" : "text-[var(--text-tertiary)]"}`}>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : ""}</p>
                      {mine && seenMessageId === message.id && <p className="mt-1 text-[11px] text-white/80">Seen</p>}
                    </div>
                  </div>
                );
              })}
              {!!typingUserId && <p className="text-xs text-[var(--text-secondary)]">User is typing...</p>}
            </div>
          </div>

          <footer className="border-t border-[var(--border)] p-4">
            <div className="space-y-3">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Optional image URL" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    emitTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Write a message..."
                  rows={3}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void sendMessage()} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                  Send
                </button>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
