"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { type SocialCommunity, type SocialUser, socialFetch } from "@/lib/social-api";

export default function SocialExplorePage() {
  const [me, setMe] = useState<SocialUser | null>(null);
  const [suggestions, setSuggestions] = useState<SocialUser[]>([]);
  const [communities, setCommunities] = useState<SocialCommunity[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    void loadPage("");
  }, []);

  async function loadPage(term: string) {
    setLoading(true);
    setError("");
    try {
      const [meData, suggestionData, communityData] = await Promise.all([
        socialFetch<SocialUser>("/social/profile/me"),
        socialFetch<{ users: SocialUser[] }>("/social/suggestions?limit=8"),
        socialFetch<{ items: SocialCommunity[] }>(`/social/communities?page=1&page_size=12&search=${encodeURIComponent(term)}`),
      ]);
      setMe(meData);
      setSuggestions(suggestionData.users || []);
      setCommunities(communityData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load social home");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow(user: SocialUser) {
    const previous = suggestions;
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? {
              ...item,
              is_following: !item.is_following,
              followers_count: item.is_following ? Math.max(0, item.followers_count - 1) : item.followers_count + 1,
            }
          : item
      )
    );
    try {
      await socialFetch(`/social/users/${user.id}/follow`, { method: user.is_following ? "DELETE" : "POST" });
    } catch (err) {
      setSuggestions(previous);
      setError(err instanceof Error ? err.message : "Failed to update follow");
    }
  }

  async function toggleJoin(community: SocialCommunity) {
    const previous = communities;
    setCommunities((prev) =>
      prev.map((item) =>
        item.id === community.id
          ? {
              ...item,
              is_member: !item.is_member,
              member_count: item.is_member ? Math.max(0, item.member_count - 1) : item.member_count + 1,
            }
          : item
      )
    );
    try {
      await socialFetch(`/social/communities/${community.slug}/${community.is_member ? "leave" : "join"}`, { method: "POST" });
    } catch (err) {
      setCommunities(previous);
      setError(err instanceof Error ? err.message : "Failed to update community membership");
    }
  }

  async function createCommunity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const created = await socialFetch<SocialCommunity>("/social/communities", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          description,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
        }),
      });
      setCommunities((prev) => [created, ...prev]);
      setName("");
      setSlug("");
      setDescription("");
      setAvatarUrl("");
      setBannerUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create community");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(123,32,58,0.95),rgba(46,31,31,0.96))] p-6 text-white shadow-[var(--shadow-xl)]">
        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/70">Messaging + Communities</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Build conversations first, then let communities pull people back in.</h1>
            <p className="mt-4 max-w-2xl text-sm text-white/78 md:text-base">
              Follow people, open DMs, create communities, and keep every room live with persistent chat.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/messages" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[var(--primary-dark)]">Open Messages</Link>
              <Link href="/communities" className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white">Browse Communities</Link>
              {me && <Link href={`/u/${me.id}`} className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white">View Profile</Link>}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.6rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="rounded-2xl bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/60">Your network</p>
              <p className="mt-2 text-3xl font-semibold">{me?.followers_count || 0}</p>
              <p className="text-sm text-white/75">Followers available to message and invite into communities.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/10 p-4">
                <p className="text-2xl font-semibold">{suggestions.length}</p>
                <p className="text-xs text-white/70">Suggested users</p>
              </div>
              <div className="rounded-2xl bg-black/10 p-4">
                <p className="text-2xl font-semibold">{communities.length}</p>
                <p className="text-xs text-white/70">Live communities</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!!error && <div className="rounded-2xl border border-[var(--error-dark)] bg-red-100 px-4 py-3 text-sm text-[var(--error-dark)]">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.85fr,1.15fr,0.9fr]">
        <section className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Suggested users</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">People to follow</h2>
            </div>
            <button type="button" onClick={() => void loadPage(search)} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">Refresh</button>
          </div>
          <div className="space-y-3">
            {loading && <p className="text-sm text-[var(--text-secondary)]">Loading people...</p>}
            {!loading && !suggestions.length && <p className="text-sm text-[var(--text-secondary)]">No suggestions right now.</p>}
            {suggestions.map((user) => (
              <div key={user.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <Link href={`/u/${user.id}`} className="block">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{user.display_name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">@{user.username}</p>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">{user.followers_count} followers • {user.current_streak_days} day streak</p>
                </Link>
                <button type="button" onClick={() => void toggleFollow(user)} className="mt-3 w-full rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white">
                  {user.is_following ? "Unfollow" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Discover</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Communities</h2>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, slug, or description" className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => {
                  setSearch(query);
                  void loadPage(query);
                }}
                className="rounded-xl border border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {communities.map((community) => (
              <div key={community.id} className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                <Link href={`/communities/${community.slug}`} className="block">
                  <p className="text-base font-semibold text-[var(--text-primary)]">{community.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">c/{community.slug} • {community.member_count} members</p>
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--text-secondary)]">{community.description || "No description yet."}</p>
                </Link>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => void toggleJoin(community)} className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white">
                    {community.is_member ? "Leave" : "Join"}
                  </button>
                  <Link href={`/communities/${community.slug}`} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Create community</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Start a new room</h2>
          <form onSubmit={createCommunity} className="mt-4 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Custom slug (optional)" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar image URL" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="Banner image URL" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <button type="submit" disabled={creating || !name.trim()} className="w-full rounded-xl bg-[var(--primary-dark)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "Creating..." : "Create community"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
