"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";

import { socialFetch } from "@/lib/social-api";

type SocialUser = {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  followers_count: number;
  following_count: number;
  active_days: number;
  current_streak_days: number;
  is_following: boolean;
  is_self: boolean;
};

type PaginatedUsers = {
  page: number;
  page_size: number;
  items: SocialUser[];
};

export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = String(params.userId || "");

  const [profile, setProfile] = useState<SocialUser | null>(null);
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);

  const [followersPage, setFollowersPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    void loadProfile();
    void loadFollowers(1, true);
    void loadFollowing(1, true);
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const data = await socialFetch<SocialUser>(`/social/users/${userId}`);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowers(page: number, replace = false) {
    try {
      const data = await socialFetch<PaginatedUsers>(`/social/users/${userId}/followers?page=${page}&page_size=20`);
      setFollowersPage(page);
      setFollowers((prev) => (replace ? data.items : [...prev, ...data.items]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load followers");
    }
  }

  async function loadFollowing(page: number, replace = false) {
    try {
      const data = await socialFetch<PaginatedUsers>(`/social/users/${userId}/following?page=${page}&page_size=20`);
      setFollowingPage(page);
      setFollowing((prev) => (replace ? data.items : [...prev, ...data.items]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load following");
    }
  }

  async function toggleFollow() {
    if (!profile || profile.is_self || followLoading) return;

    const previous = profile;
    const nextFollowing = !profile.is_following;
    setProfile({
      ...profile,
      is_following: nextFollowing,
      followers_count: nextFollowing ? profile.followers_count + 1 : Math.max(0, profile.followers_count - 1),
    });

    setFollowLoading(true);
    setError("");
    try {
      if (previous.is_following) {
        await socialFetch(`/social/users/${profile.id}/follow`, { method: "DELETE" });
      } else {
        await socialFetch(`/social/users/${profile.id}/follow`, { method: "POST" });
      }
      await loadFollowers(1, true);
    } catch (err) {
      setProfile(previous);
      setError(err instanceof Error ? err.message : "Failed to update follow state");
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading && !profile) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-sm text-[var(--error-dark)]">{error || "Profile not found"}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      {!!error && <div className="mb-4 rounded-lg border border-[var(--error-dark)] bg-red-100 px-3 py-2 text-sm text-[var(--error-dark)]">{error}</div>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">@{profile.username}</p>
            <h1 className="text-3xl font-semibold text-[var(--primary-dark)]">{profile.display_name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{profile.bio || "No bio yet."}</p>
          </div>

          <div className="flex gap-2">
            {!profile.is_self ? (
              <button
                type="button"
                onClick={() => void toggleFollow()}
                disabled={followLoading}
                className="rounded-xl border border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {profile.is_following ? "Unfollow" : "Follow"}
              </button>
            ) : (
              <Link href="/settings/profile" className="rounded-xl border border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                Edit Profile
              </Link>
            )}
            <Link href={`/messages?userId=${profile.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
              Message
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg bg-[var(--surface-elevated)] p-3 text-center">
            <p className="text-xl font-semibold text-[var(--primary-dark)]">{profile.followers_count}</p>
            <p className="text-xs text-[var(--text-secondary)]">Followers</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-elevated)] p-3 text-center">
            <p className="text-xl font-semibold text-[var(--primary-dark)]">{profile.following_count}</p>
            <p className="text-xs text-[var(--text-secondary)]">Following</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-elevated)] p-3 text-center">
            <p className="text-xl font-semibold text-[var(--primary-dark)]">{profile.current_streak_days}</p>
            <p className="text-xs text-[var(--text-secondary)]">Current Streak</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-elevated)] p-3 text-center">
            <p className="text-xl font-semibold text-[var(--primary-dark)]">{profile.active_days}</p>
            <p className="text-xs text-[var(--text-secondary)]">Active Days</p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Followers</h2>
          <div className="space-y-2">
            {followers.map((user) => (
              <Link key={`f-${user.id}`} href={`/u/${user.id}`} className="block rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]">
                {user.display_name} <span className="text-xs text-[var(--text-secondary)]">@{user.username}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadFollowers(followersPage + 1)}
            className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
          >
            Load More
          </button>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Following</h2>
          <div className="space-y-2">
            {following.map((user) => (
              <Link key={`g-${user.id}`} href={`/u/${user.id}`} className="block rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]">
                {user.display_name} <span className="text-xs text-[var(--text-secondary)]">@{user.username}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadFollowing(followingPage + 1)}
            className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
          >
            Load More
          </button>
        </section>
      </div>
    </div>
  );
}
