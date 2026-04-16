"use client";

import React, { useEffect, useState } from "react";

import { Button, EmptyState, Input, SectionHeader, Textarea, Toast } from "@/components/ui";
import { encryptText } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const emotionTags = ["Happy", "Sad", "Anxious", "Angry", "Peaceful", "Hopeful", "Frustrated", "Grateful"];

export default function JournalPage() {
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const handleSubmit = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }
    if (!text.trim()) {
      setError("Please write something in your journal entry");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const encrypted = await encryptText(text, passphrase || "journal-default");
      const blob = new Blob([encrypted], { type: "application/octet-stream" });
      const form = new FormData();
      form.append("file", blob, "journal.enc");
      form.append("emotion_tags", selectedTags.join(","));

      const res = await fetch(`${apiBase}/journal/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Failed to save journal entry");
        return;
      }

      setSuccess("Journal entry saved securely.");
      setTimeout(() => {
        setText("");
        setPassphrase("");
        setSelectedTags([]);
        setSuccess("");
      }, 1800);
    } catch (err) {
      setError("Failed to save journal entry. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <EmptyState
        icon="📔"
        title="Sign In Required"
        description="Please sign in to access your private journal"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className="app-page-shell medium">
      <section className="app-page-intro">
        <div className="app-page-intro-grid">
          <div className="app-page-intro-copy">
            <SectionHeader
              title="Private Journal"
              subtitle="A journal should feel quiet, protected, and reflective. Write freely knowing your words are encrypted before upload."
            />
          </div>
          <div className="app-page-intro-side">
            <div className="app-page-chip-row">
              <span className="app-page-chip">Client-side encryption</span>
              <span className="app-page-chip">Private reflection space</span>
            </div>
          </div>
        </div>
      </section>

      <div className="app-panel success">
        <p className="landing-kicker">Privacy</p>
        <h3 style={{ marginBottom: "0.4rem", color: "var(--success)" }}>Your writing stays protected</h3>
        <p style={{ margin: 0 }}>
          Entries are encrypted client-side using AES-GCM before they are uploaded.
        </p>
      </div>

      <section className="app-grid-2">
        <div className="app-panel soft">
          <label className="label">Your Journal Entry</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write what happened, what it felt like, and what you need next."
            rows={12}
          />
        </div>

        <div className="app-list-stack">
          <div className="app-panel">
            <label className="label">Emotions</label>
            <div className="app-segmented-row">
              {emotionTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`app-segmented-button${selectedTags.includes(tag) ? " active" : ""}`}
                  onClick={() =>
                    setSelectedTags((current) =>
                      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]
                    )
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="app-panel">
            <label className="label">Encryption Passphrase</label>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Optional passphrase"
            />
            <p className="app-note" style={{ marginTop: "0.65rem" }}>
              Add a passphrase if you want an extra layer beyond the default encrypted upload.
            </p>
          </div>

          <div className="app-panel">
            <p className="landing-kicker">Writing prompts</p>
            <ul className="app-bullet-list">
              <li>What felt hardest today?</li>
              <li>What helped even a little?</li>
              <li>What do you want tomorrow to feel like?</li>
            </ul>
          </div>
        </div>
      </section>

      {error && (
        <div className="app-panel critical">
          <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
        </div>
      )}

      <div className="app-panel" style={{ marginBottom: 0 }}>
        <Button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              Encrypting and saving...
            </span>
          ) : (
            "Save Entry Securely"
          )}
        </Button>
      </div>

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
