"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  type PaginatedResponse,
  type SocialCommunity,
  type SocialMessage,
  type SocialUser,
  socialFetch,
} from "@/lib/social-api";
import { getSocialSocket, refreshSocketAuth } from "@/lib/social-socket";

export default function CommunityDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topLoadingRef = useRef(false);

  const [community, setCommunity] = useState<SocialCommunity | null>(null);
  const [members, setMembers] = useState<SocialUser[]>([]);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [membersHasMore, setMembersHasMore] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const groupedMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!slug) return;
    void bootstrap();
  }, [slug]);

  useEffect(() => {
    if (!community?.id) return;
    refreshSocketAuth();
    const socket = getSocialSocket();
    socket.emit("join_community_chat", community.id);

    const onMessage = (message: SocialMessage) => {
      if (message.communityId !== community.id) return;
      setMessages((prev) => [...prev, message]);
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    };

    socket.on("new_community_message", onMessage);
    return () => {
      socket.off("new_community_message", onMessage);
    };
  }, [community?.id]);

  async function bootstrap() {
    setLoading(true);
    setError("");
    try {
      const [communityData, memberData, messageData] = await Promise.all([
        socialFetch<SocialCommunity>(`/social/communities/${slug}`),
        socialFetch<PaginatedResponse<SocialUser>>(`/social/communities/${slug}/members?page=1&page_size=12`),
        socialFetch<{ items: SocialMessage[] }>(`/social/communities/${slug}/messages?limit=50`),
      ]);
      setCommunity(communityData);
      setMembers(memberData.items || []);
      setMembersHasMore(Boolean(memberData.has_more));
      setMemberPage(1);
      setMessages(messageData.items || []);
      setOldestMessageId(messageData.items?.[0]?.id || "");
      setHasMoreMessages((messageData.items || []).length >= 50);
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community");
    } finally {
      setLoading(false);
    }
  }

  async function loadOlderMessages() {
    if (!slug || !oldestMessageId || !hasMoreMessages || topLoadingRef.current) return;
    const node = scrollRef.current;
    const previousHeight = node?.scrollHeight || 0;
    topLoadingRef.current = true;
    try {
      const data = await socialFetch<{ items: SocialMessage[] }>(
        `/social/communities/${slug}/messages?limit=50&before_id=${oldestMessageId}`
      );
      const older = data.items || [];
      if (!older.length) {
        setHasMoreMessages(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      setOldestMessageId(older[0].id);
      if (older.length < 50) setHasMoreMessages(false);
      requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (current) current.scrollTop = current.scrollHeight - previousHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load older messages");
    } finally {
      topLoadingRef.current = false;
    }
  }

  async function loadMoreMembers() {
    if (!membersHasMore) return;
    try {
      const nextPage = memberPage + 1;
      const data = await socialFetch<PaginatedResponse<SocialUser>>(
        `/social/communities/${slug}/members?page=${nextPage}&page_size=12`
      );
      setMembers((prev) => [...prev, ...(data.items || [])]);
      setMemberPage(nextPage);
      setMembersHasMore(Boolean(data.has_more));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more members");
    }
  }

  async function toggleMembership() {
    if (!community) return;
    const previous = community;
    setCommunity({
      ...community,
      is_member: !community.is_member,
      member_count: community.is_member ? Math.max(0, community.member_count - 1) : community.member_count + 1,
    });
    try {
      await socialFetch(`/social/communities/${community.slug}/${community.is_member ? "leave" : "join"}`, { method: "POST" });
      await bootstrap();
    } catch (err) {
      setCommunity(previous);
      setError(err instanceof Error ? err.message : "Failed to update membership");
    }
  }

  async function sendMessage() {
    if (!community?.id || (!draft.trim() && !imageUrl.trim())) return;
    const socket = getSocialSocket();
    socket.emit("send_community_message", {
      communityId: community.id,
      content: draft.trim(),
      imageUrl: imageUrl.trim() || undefined,
    });
    setDraft("");
    setImageUrl("");
  }

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading community...</div>;
  }

  if (!community) {
    return <div className="p-6 text-sm text-[var(--error-dark)]">{error || "Community not found"}</div>;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-6">
      {!!error && <div className="rounded-2xl border border-[var(--error-dark)] bg-red-100 px-4 py-3 text-sm text-[var(--error-dark)]">{error}</div>}

      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="h-36 w-full bg-[linear-gradient(135deg,rgba(123,32,58,0.95),rgba(212,185,150,0.75))]" />
        <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">c/{community.slug}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{community.name}</h1>
            <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)]">{community.description || "No description yet."}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void toggleMembership()} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                {community.is_member ? "Leave community" : "Join community"}
              </button>
              <Link href="/communities" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">Back to directory</Link>
            </div>
          </div>
          <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Members</p>
              <p className="mt-1 text-3xl font-semibold text-[var(--text-primary)]">{community.member_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Owner</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{community.owner?.display_name || "Unknown"}</p>
              {community.owner?.id && <Link href={`/u/${community.owner.id}`} className="text-xs text-[var(--text-secondary)]">@{community.owner.username}</Link>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.72fr,1.28fr]">
        <section className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Member list</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Who is here</h2>
            </div>
          </div>
          <div className="space-y-3">
            {members.map((member) => (
              <Link key={member.id} href={`/u/${member.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{member.display_name}</p>
                <p className="text-xs text-[var(--text-secondary)]">@{member.username}</p>
              </Link>
            ))}
          </div>
          {membersHasMore && (
            <button type="button" onClick={() => void loadMoreMembers()} className="mt-4 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
              Load more members
            </button>
          )}
        </section>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Live room</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">#general</h2>
          </div>
          <div
            ref={scrollRef}
            onScroll={() => {
              const node = scrollRef.current;
              if (node && node.scrollTop < 120) void loadOlderMessages();
            }}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {hasMoreMessages && (
              <div className="mb-4 text-center text-xs text-[var(--text-tertiary)]">
                Scroll up to load earlier messages
              </div>
            )}
            <div className="space-y-4">
              {groupedMessages.map((message, index) => {
                const previous = groupedMessages[index - 1];
                const showHeader = !previous || previous.senderId !== message.senderId;
                return (
                  <div key={message.id} className="max-w-3xl">
                    {showHeader && (
                      <div className="mb-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{message.senderDisplayName}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">@{message.senderUsername}</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                      {!!message.content && <p className="text-sm text-[var(--text-primary)]">{message.content}</p>}
                      {!!message.imageUrl && <img src={message.imageUrl} alt="" className="mt-2 max-h-72 rounded-xl object-cover" />}
                      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-[var(--border)] p-4">
            {!community.is_member ? (
              <p className="text-sm text-[var(--text-secondary)]">Join this community to send messages.</p>
            ) : (
              <div className="space-y-3">
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Optional image URL" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something to the community..." rows={3} className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
                  <button type="button" onClick={() => void sendMessage()} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
