"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import { type SocialCommunity, socialFetch } from "@/lib/social-api";

export default function CommunitiesPage() {
  const [query, setQuery] = useState("");
  const [communities, setCommunities] = useState<SocialCommunity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    void loadCommunities(1, true, "");
  }, []);

  async function loadCommunities(nextPage: number, replace: boolean, term: string) {
    if (replace) setLoading(true);
    setError("");
    try {
      const data = await socialFetch<{ items: SocialCommunity[]; has_more: boolean }>(
        `/social/communities?page=${nextPage}&page_size=12&search=${encodeURIComponent(term)}`
      );
      setCommunities((prev) => (replace ? data.items || [] : [...prev, ...(data.items || [])]));
      setHasMore(Boolean(data.has_more));
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communities");
    } finally {
      setLoading(false);
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
      setError(err instanceof Error ? err.message : "Failed to update membership");
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-6">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Browse</p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--text-primary)]">Community directory</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Search all communities and jump into any live `#general` room.</p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" />
            <button type="button" onClick={() => void loadCommunities(1, true, query)} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Search</button>
          </div>
        </div>
      </section>

      {!!error && <div className="rounded-2xl border border-[var(--error-dark)] bg-red-100 px-4 py-3 text-sm text-[var(--error-dark)]">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {communities.map((community) => (
          <div key={community.id} className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-tertiary)]">c/{community.slug}</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{community.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{community.member_count} members</p>
            <p className="mt-3 min-h-16 text-sm text-[var(--text-secondary)]">{community.description || "No description yet."}</p>
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

      {!loading && hasMore && (
        <button type="button" onClick={() => void loadCommunities(page + 1, false, query)} className="mx-auto rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
          Load more
        </button>
      )}
      {loading && <p className="text-sm text-[var(--text-secondary)]">Loading communities...</p>}
    </div>
  );
}
