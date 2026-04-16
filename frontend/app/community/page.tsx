"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";

import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type CommunityUser = {
  id: string;
  email?: string | null;
  display_name: string;
  handle: string;
  current_streak_days?: number;
  active_days?: number;
  is_following?: boolean;
};

type SocialGroup = {
  chat_id: string;
  name: string;
  member_count: number;
  joined?: boolean;
};

type DirectChat = {
  chat_id: string;
  kind: "direct";
  partner: CommunityUser;
  last_message?: string | null;
};

type PendingFriendRequest = {
  request_id: string;
  requester: CommunityUser;
  created_at?: string | null;
};

type SocialOverview = {
  profile: CommunityUser & {
    followers_count?: number;
    following_count?: number;
  };
  friends: CommunityUser[];
  pending_received: PendingFriendRequest[];
  discover: CommunityUser[];
  groups: SocialGroup[];
  direct_chats: DirectChat[];
};

type SocialProfile = {
  user: CommunityUser;
  metrics: {
    followers: number;
    following: number;
    active_days: number;
    current_streak_days: number;
  };
  is_self: boolean;
  is_following: boolean;
};

type SocialMessage = {
  id: string;
  chat_id: string;
  body: string;
  created_at?: string | null;
  sender_id: string;
  sender_name: string;
  is_mine: boolean;
};

type ActiveChat = {
  chat_id: string;
  kind: "direct" | "group";
  name: string;
  partner?: CommunityUser;
  member_count?: number;
};

const composerVariants: Variants = {
  idle: { y: 0, scale: 1 },
  sending: {
    y: -2,
    scale: 1.003,
    transition: { type: "spring", stiffness: 320, damping: 24 },
  },
};

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CommunityPage() {
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [communityMessages, setCommunityMessages] = useState<SocialMessage[]>([]);
  const [communityDraft, setCommunityDraft] = useState("");

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"community" | "chat" | "profile">("community");
  const [viewedProfile, setViewedProfile] = useState<SocialProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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
    if (!token) return;
    void loadOverview(token, true);
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [communityMessages, sending]);

  const communityTitle = useMemo(() => activeChat?.name || "Social chat", [activeChat]);

  const leaderboard = useMemo(() => {
    const uniqueUsers = new Map<string, CommunityUser>();
    (overview?.friends || []).forEach((user) => uniqueUsers.set(user.id, user));
    (overview?.discover || []).forEach((user) => {
      if (!uniqueUsers.has(user.id)) uniqueUsers.set(user.id, user);
    });

    return Array.from(uniqueUsers.values())
      .sort((a, b) => (b.current_streak_days || 0) - (a.current_streak_days || 0))
      .slice(0, 10);
  }, [overview]);

  const myStreak = useMemo(() => {
    return overview?.profile.current_streak_days || 0;
  }, [overview]);

  const activeDays = useMemo(() => {
    return overview?.profile.active_days || 0;
  }, [overview]);

  const profileForView = useMemo(() => {
    if (viewedProfile) {
      return {
        user: viewedProfile.user,
        metrics: viewedProfile.metrics,
        is_self: viewedProfile.is_self,
        is_following: viewedProfile.is_following,
      };
    }
    if (!overview?.profile) return null;
    return {
      user: overview.profile,
      metrics: {
        followers: overview.profile.followers_count || 0,
        following: overview.profile.following_count || 0,
        active_days: overview.profile.active_days || 0,
        current_streak_days: overview.profile.current_streak_days || 0,
      },
      is_self: true,
      is_following: false,
    };
  }, [overview, viewedProfile]);

  const profileStreak = profileForView?.metrics.current_streak_days || myStreak;
  const profileActiveDays = profileForView?.metrics.active_days || activeDays;

  const activityGrid = useMemo(() => {
    const seed = (profileStreak * 37 + profileActiveDays * 11 + (profileForView?.user.id.length || 2) * 17) % 997;
    return Array.from({ length: 7 }, (_, row) =>
      Array.from({ length: 12 }, (_, col) => {
        const value = (seed + row * 19 + col * 11) % 7;
        return value >= 2;
      })
    );
  }, [profileActiveDays, profileForView, profileStreak]);

  const badges = useMemo(
    () => [
      { label: "100-Day Streak", level: "Epic", threshold: 100, color: "epic" as const },
      { label: "50-Day Streak", level: "Rare", threshold: 50, color: "rare" as const },
      { label: "25-Day Streak", level: "Standard", threshold: 25, color: "standard" as const },
      { label: "10-Day Streak", level: "Standard", threshold: 10, color: "green" as const },
    ],
    []
  );

  async function loadOverview(activeToken: string, hydrateDefaultThread = false, preferredChatId: string | null = null) {
    setLoadingOverview(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/social/overview`, { headers: getAuthHeaders(activeToken) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load social overview");
        return;
      }

      const next = data as SocialOverview;
      setOverview(next);

      if (!hydrateDefaultThread) return;

      if (preferredChatId) {
        const direct = next.direct_chats.find((item) => item.chat_id === preferredChatId);
        if (direct) {
          await loadChatThread(activeToken, {
            chat_id: direct.chat_id,
            kind: "direct",
            name: direct.partner.display_name,
            partner: direct.partner,
          });
          return;
        }
        const group = next.groups.find((item) => item.chat_id === preferredChatId);
        if (group) {
          await loadChatThread(activeToken, {
            chat_id: group.chat_id,
            kind: "group",
            name: group.name,
            member_count: group.member_count,
          });
          return;
        }
      }

      if (next.direct_chats.length > 0) {
        const first = next.direct_chats[0];
        await loadChatThread(activeToken, {
          chat_id: first.chat_id,
          kind: "direct",
          name: first.partner.display_name,
          partner: first.partner,
        });
        return;
      }

      if (next.groups.length > 0) {
        const firstGroup = next.groups[0];
        await loadChatThread(activeToken, {
          chat_id: firstGroup.chat_id,
          kind: "group",
          name: firstGroup.name,
          member_count: firstGroup.member_count,
        });
        return;
      }

      setActiveChat(null);
      setCommunityMessages([]);
    } catch (err) {
      console.error(err);
      setError("Failed to load social overview");
    } finally {
      setLoadingOverview(false);
    }
  }

  async function loadChatThread(activeToken: string, chat: ActiveChat) {
    setLoadingThread(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/social/chats/${chat.chat_id}/messages`, {
        headers: getAuthHeaders(activeToken),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load conversation");
        return;
      }

      const serverChat = (data.chat || {}) as Partial<ActiveChat>;
      setActiveChat({
        ...chat,
        kind: (serverChat.kind as "direct" | "group") || chat.kind,
        name: serverChat.name || chat.name,
        member_count: serverChat.member_count ?? chat.member_count,
        partner: (serverChat.partner as CommunityUser | undefined) || chat.partner,
      });
      setCommunityMessages((data.messages || []) as SocialMessage[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load conversation");
    } finally {
      setLoadingThread(false);
    }
  }

  async function respondToFriendRequest(requestId: string, action: "accept" | "reject") {
    if (!token) return;
    setError("");
    try {
      const res = await fetch(`${apiBase}/social/friends/respond`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Unable to process request");
        return;
      }
      await loadOverview(token, false, activeChat?.chat_id || null);
    } catch (err) {
      console.error(err);
      setError("Unable to process request");
    }
  }

  async function openDirectChat(targetUserId: string, user: CommunityUser) {
    if (!token) return;
    setError("");
    try {
      const res = await fetch(`${apiBase}/social/chats/direct`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Unable to open direct chat");
        return;
      }

      const chatId = data.chat_id as string;
      await loadChatThread(token, {
        chat_id: chatId,
        kind: "direct",
        name: user.display_name,
        partner: user,
      });
      setActiveTab("chat");
      await loadOverview(token, false, chatId);
    } catch (err) {
      console.error(err);
      setError("Unable to open direct chat");
    }
  }

  async function openProfile(userId: string) {
    if (!token) return;
    setLoadingProfile(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/social/profiles/${userId}`, {
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to load profile");
        return;
      }
      setViewedProfile(data as SocialProfile);
      setActiveTab("profile");
    } catch (err) {
      console.error(err);
      setError("Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function toggleFollowProfile() {
    if (!token || !profileForView || profileForView.is_self || followLoading) return;
    setFollowLoading(true);
    setError("");
    const nextAction = profileForView.is_following ? "unfollow" : "follow";
    try {
      const res = await fetch(`${apiBase}/social/${nextAction}`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ target_user_id: profileForView.user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || `Failed to ${nextAction}`);
        return;
      }

      await openProfile(profileForView.user.id);
      await loadOverview(token, false, activeChat?.chat_id || null);
    } catch (err) {
      console.error(err);
      setError(`Failed to ${nextAction}`);
    } finally {
      setFollowLoading(false);
    }
  }

  async function sendCommunityMessage() {
    const body = communityDraft.trim();
    if (!token || !activeChat || !body || sending) return;

    setSending(true);
    setError("");
    const optimisticMessage: SocialMessage = {
      id: `tmp-community-${Date.now()}`,
      chat_id: activeChat.chat_id,
      body,
      created_at: new Date().toISOString(),
      sender_id: overview?.profile.id || "me",
      sender_name: overview?.profile.display_name || "You",
      is_mine: true,
    };

    setCommunityMessages((prev) => [...prev, optimisticMessage]);
    setCommunityDraft("");

    try {
      const res = await fetch(`${apiBase}/social/chats/${activeChat.chat_id}/messages`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommunityMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
        setError(data.detail || "Failed to send message");
        return;
      }

      setCommunityMessages((prev) =>
        prev.map((message) => (message.id === optimisticMessage.id ? (data.message as SocialMessage) : message))
      );
      await loadOverview(token, false, activeChat.chat_id);
    } catch (err) {
      console.error(err);
      setCommunityMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return null;
  }

  const openDefaultChat = async () => {
    if (!token) return;
    if (overview?.direct_chats?.length) {
      const first = overview.direct_chats[0];
      await loadChatThread(token, {
        chat_id: first.chat_id,
        kind: "direct",
        name: first.partner.display_name,
        partner: first.partner,
      });
      setActiveTab("chat");
      return;
    }

    if (overview?.friends?.length) {
      const friend = overview.friends[0];
      await openDirectChat(friend.id, friend);
      setActiveTab("chat");
      return;
    }

    setError("Add a friend first to start chatting.");
  };

  const openMyProfile = () => {
    setViewedProfile(null);
    setActiveTab("profile");
  };

  return (
    <div className="community-mobile">
      {activeTab === "community" && (
        <>
          <header className="community-mobile-head">
            <div>
              <h1>Community</h1>
              <p>Connect with warriors</p>
            </div>
            <button type="button" className="community-chat-cta" onClick={() => void openDefaultChat()}>
              Chat
            </button>
          </header>

          {!!error && <div className="community-error mobile">{error}</div>}

          <section className="community-mobile-card">
            <div className="community-mobile-card-head">
              <h2>Top Streaks</h2>
              <span>Live</span>
            </div>
            <div className="community-mobile-list">
              {loadingOverview && <p className="community-note">Loading leaderboard...</p>}
              {!loadingOverview &&
                leaderboard.map((user, index) => (
                  <div key={user.id} className="community-rank-row">
                    <div className="community-rank">#{index + 1}</div>
                    <div className="community-avatar">{getInitials(user.display_name)}</div>
                    <div className="community-rank-copy">
                      <strong>{user.display_name}</strong>
                      <span>MASTER RANK</span>
                    </div>
                    <button
                      type="button"
                      className="community-rank-days"
                      onClick={() => void openProfile(user.id)}
                    >
                      {user.current_streak_days || 0} days
                    </button>
                  </div>
                ))}
            </div>
          </section>

          <section className="community-mobile-card">
            <div className="community-mobile-card-head">
              <h2>Friend Requests</h2>
              <span>{overview?.pending_received.length ?? 0}</span>
            </div>
            <div className="community-mobile-list">
              {overview?.pending_received.length ? (
                overview.pending_received.map((request) => (
                  <div key={request.request_id} className="community-request-row">
                    <div className="community-avatar small">{getInitials(request.requester.display_name)}</div>
                    <div className="community-rank-copy">
                      <strong>{request.requester.display_name}</strong>
                      <span>{request.requester.handle}</span>
                    </div>
                    <button
                      type="button"
                      className="community-icon-btn"
                      onClick={() => void respondToFriendRequest(request.request_id, "accept")}
                    >
                      +
                    </button>
                  </div>
                ))
              ) : (
                <p className="community-note">No incoming requests.</p>
              )}
            </div>
          </section>

          {!!overview?.friends.length && (
            <section className="community-mobile-card">
              <div className="community-mobile-card-head">
                <h2>Friends</h2>
                <span>{overview.friends.length}</span>
              </div>
              <div className="community-mobile-list">
                {overview.friends.slice(0, 6).map((friend) => (
                  <div key={friend.id} className="community-request-row">
                    <div className="community-avatar small">{getInitials(friend.display_name)}</div>
                    <div className="community-rank-copy">
                      <strong>{friend.display_name}</strong>
                      <span>{friend.handle}</span>
                    </div>
                    <button type="button" className="community-icon-btn" onClick={() => void openDirectChat(friend.id, friend)}>
                      Go
                    </button>
                    <button type="button" className="community-icon-btn" onClick={() => void openProfile(friend.id)}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "chat" && (
        <>
          <header className="community-mobile-head chat">
            <button type="button" className="community-back-btn" onClick={() => setActiveTab("community")}>
              Back
            </button>
            <div>
              <h1>{communityTitle}</h1>
              <p>Share your journey</p>
            </div>
            <span className="community-status-dot" />
          </header>

          <div className="community-chat-stream">
            {loadingThread && <p className="community-note">Loading conversation...</p>}
            {!loadingThread && !activeChat && (
              <div className="community-empty chat">
                <h3>Select a conversation</h3>
                <p>Open a chat from the community tab.</p>
              </div>
            )}
            {!loadingThread &&
              activeChat &&
              communityMessages.map((message) => (
                <div key={message.id} className={`community-chat-row ${message.is_mine ? "mine" : "other"}`}>
                  {!message.is_mine && <div className="community-avatar tiny">{getInitials(message.sender_name)}</div>}
                  <div className={`community-chat-bubble ${message.is_mine ? "mine" : "other"}`}>
                    {!message.is_mine && <strong>{message.sender_name}</strong>}
                    <p>{message.body}</p>
                    <span>{formatTimestamp(message.created_at)}</span>
                  </div>
                </div>
              ))}
            <div ref={endRef} />
          </div>

          <motion.div
            variants={composerVariants}
            initial={false}
            animate={sending ? "sending" : "idle"}
            className="community-chat-composer-wrap"
          >
            <div className="community-chat-composer">
              <textarea
                value={communityDraft}
                onChange={(e) => setCommunityDraft(e.target.value)}
                placeholder="Type your message..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendCommunityMessage();
                  }
                }}
                disabled={sending || !activeChat}
                className="community-chat-input"
              />
              <button
                onClick={() => void sendCommunityMessage()}
                disabled={sending || !communityDraft.trim() || !activeChat}
                className="community-chat-send"
              >
                ^
              </button>
            </div>
          </motion.div>
        </>
      )}

      {activeTab === "profile" && (
        <>
          <section className="community-mobile-card">
            <div className="community-mobile-card-head">
              <h2>{profileForView?.is_self ? "My Profile" : "Profile"}</h2>
              <button type="button" className="community-icon-btn" onClick={openMyProfile}>Me</button>
            </div>
            {loadingProfile && <p className="community-note">Loading profile...</p>}
            {!!profileForView && (
              <>
                <div className="community-request-row" style={{ marginBottom: 10 }}>
                  <div className="community-avatar">{getInitials(profileForView.user.display_name)}</div>
                  <div className="community-rank-copy">
                    <strong>{profileForView.user.display_name}</strong>
                    <span>{profileForView.user.handle}</span>
                  </div>
                  {!profileForView.is_self && (
                    <button
                      type="button"
                      className="community-chat-cta"
                      onClick={() => void toggleFollowProfile()}
                      disabled={followLoading}
                    >
                      {profileForView.is_following ? "Unfollow" : "Follow"}
                    </button>
                  )}
                </div>
                <div className="community-profile-stats">
                  <div>
                    <strong>{profileForView.metrics.followers}</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>{profileForView.metrics.following}</strong>
                    <span>Following</span>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="community-mobile-card">
            <div className="community-mobile-card-head">
              <h2>Achievements</h2>
              <span>{badges.filter((badge) => profileStreak >= badge.threshold).length}</span>
            </div>
            <div className="community-badges-grid">
              {badges.map((badge) => {
                const unlocked = profileStreak >= badge.threshold;
                return (
                  <div key={badge.label} className={`community-badge ${badge.color} ${unlocked ? "on" : "off"}`}>
                    <div className="community-badge-shield">A</div>
                    <strong>{badge.label}</strong>
                    <span>{badge.level}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="community-mobile-card">
            <div className="community-profile-stats">
              <div>
                <strong>{profileActiveDays}</strong>
                <span>Active Days</span>
              </div>
              <div>
                <strong>{profileStreak}d</strong>
                <span>Current Streak</span>
              </div>
            </div>

            <div className="community-heatmap">
              {activityGrid.map((row, rowIndex) => (
                <div key={rowIndex} className="community-heatmap-row">
                  {row.map((on, colIndex) => (
                    <div key={`${rowIndex}-${colIndex}`} className={`community-heatmap-cell ${on ? "on" : "off"}`} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <nav className="community-bottom-nav">
        <button type="button" className={activeTab === "community" ? "active" : ""} onClick={() => setActiveTab("community")}>
          C
        </button>
        <button type="button" className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>
          M
        </button>
        <button type="button" className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}>
          P
        </button>
      </nav>
    </div>
  );
}
