"use client";

import React, { useEffect, useState } from "react";

import { socialFetch } from "@/lib/social-api";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
};

export default function EditProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const profile = await socialFetch<Profile>("/social/profile/me");
      setUsername(profile.username || "");
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
      setBannerUrl(profile.banner_url || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await socialFetch<Profile>("/social/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          username,
          display_name: displayName,
          bio,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
        }),
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading profile...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="mb-4 text-3xl font-semibold text-[var(--primary-dark)]">Edit Profile</h1>

      {!!error && <div className="mb-3 rounded-lg border border-[var(--error-dark)] bg-red-100 px-3 py-2 text-sm text-[var(--error-dark)]">{error}</div>}
      {!!success && <div className="mb-3 rounded-lg border border-green-700 bg-green-100 px-3 py-2 text-sm text-green-800">{success}</div>}

      <form onSubmit={saveProfile} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm text-[var(--text-primary)]">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              placeholder="username"
            />
          </label>

          <label className="grid gap-1 text-sm text-[var(--text-primary)]">
            Display Name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              placeholder="Display Name"
            />
          </label>

          <label className="grid gap-1 text-sm text-[var(--text-primary)]">
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              placeholder="Tell people about yourself"
            />
          </label>

          <label className="grid gap-1 text-sm text-[var(--text-primary)]">
            Avatar URL
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              placeholder="https://..."
            />
          </label>

          <label className="grid gap-1 text-sm text-[var(--text-primary)]">
            Banner URL
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              placeholder="https://..."
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl border border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
