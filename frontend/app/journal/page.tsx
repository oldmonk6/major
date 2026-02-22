"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader, Card, Button, Input, Textarea, Toast, EmptyState } from "@/components/ui";
import { encryptText, getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const emotionTags = [
  "Happy",
  "Sad",
  "Anxious",
  "Angry",
  "Peaceful",
  "Hopeful",
  "Frustrated",
  "Grateful",
];

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
        setError(data.error || "Failed to save journal entry");
        return;
      }

      setSuccess("Journal entry saved securely! Your privacy is protected.");

      // Reset form
      setTimeout(() => {
        setText("");
        setPassphrase("");
        setSelectedTags([]);
        setSuccess("");
      }, 2000);
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
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <SectionHeader
        title="Private Journal"
        subtitle="Write freely knowing your thoughts are encrypted and secure"
      />

      <Card style={{ borderLeft: "4px solid var(--primary-light)", marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--primary-light)" }}>🔒 Your Privacy is Protected</h3>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          All journal entries are encrypted client-side using AES-GCM. Only you can read your entries.
        </p>
      </Card>

      <Card>
        <label className="label">Your Journal Entry</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your thoughts, feelings, and reflections... whatever is on your mind. This is your safe space."
          rows={8}
        />

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="label">How are you feeling? (Select emotions that apply)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem" }}>
            {emotionTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(selectedTags.filter((t) => t !== tag));
                  } else {
                    setSelectedTags([...selectedTags, tag]);
                  }
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: selectedTags.includes(tag)
                    ? "2px solid var(--primary-light)"
                    : "1px solid var(--border)",
                  background: selectedTags.includes(tag)
                    ? "rgba(6, 182, 212, 0.1)"
                    : "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  transition: "all 0.2s ease",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="label">
            Encryption Passphrase (Optional - leave blank to use default)
          </label>
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Create a passphrase to encrypt your entry"
          />
          <p style={{ fontSize: "0.9rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0 0" }}>
            If you set a passphrase, you'll need it to decrypt this entry later.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              Encrypting & Saving...
            </span>
          ) : (
            "Save Entry Securely"
          )}
        </Button>
      </Card>

      <Card style={{ background: "var(--bg-secondary)" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>💡 Journaling Tips</h3>
        <ul style={{ margin: 0, paddingLeft: "1.5rem", color: "var(--text-secondary)" }}>
          <li>Write without judgment - this is for you</li>
          <li>Express your true feelings, even if they seem difficult</li>
          <li>Notice patterns in your triggers and emotions</li>
          <li>Reflect on what helps you cope and feel better</li>
        </ul>
      </Card>

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
