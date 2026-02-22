"use client";

import React, { useState, useEffect } from "react";
import { SectionHeader, Card, Button, Slider, Toast, EmptyState } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const moods = ["😔 Sad", "😐 Neutral", "😊 Good", "😄 Great", "🤩 Excellent"];

export default function CheckInPage() {
  const [token, setToken] = useState("");
  const [craving, setCraving] = useState(5);
  const [urge, setUrge] = useState(5);
  const [mood, setMood] = useState("😊 Good");
  const [triggers, setTriggers] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastCheckin, setLastCheckin] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const handleSubmit = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/checkins`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          craving,
          urge,
          mood,
          triggers: triggers
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) throw new Error("Failed to save check-in");

      const data = await res.json();
      setLastCheckin(data);
      setSuccess("Check-in saved! Great job staying aware of your feelings.");

      // Reset form
      setTimeout(() => {
        setCraving(5);
        setUrge(5);
        setMood("😊 Good");
        setTriggers("");
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError("Failed to save check-in. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <EmptyState
        icon="🔒"
        title="Sign In Required"
        description="Please sign in to check in with your feelings"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <SectionHeader
        title="Daily Check-in"
        subtitle="Take 30 seconds to check in with yourself. This helps us understand your patterns."
      />

      <Card>
        <Slider
          value={craving}
          onChange={setCraving}
          min={0}
          max={10}
          label="How strong are your cravings right now?"
        />

        <Slider
          value={urge}
          onChange={setUrge}
          min={0}
          max={10}
          label="How strong is your urge to use?"
        />

        <div style={{ marginBottom: "1.5rem" }}>
          <label className="label">How are you feeling emotionally?</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {moods.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: mood === m ? "2px solid var(--primary-light)" : "1px solid var(--border)",
                  background: mood === m ? "rgba(6, 182, 212, 0.1)" : "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">What triggered these feelings? (Optional)</label>
          <textarea
            value={triggers}
            onChange={(e) => setTriggers(e.target.value)}
            placeholder="e.g., stress at work, social gathering, boredom"
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "1rem",
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: "80px",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--primary-light)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6, 182, 212, 0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: "1rem",
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
          disabled={loading}
          style={{ width: "100%", marginTop: "1.5rem", justifyContent: "center" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              Saving...
            </span>
          ) : (
            "Save Check-in"
          )}
        </Button>
      </Card>

      {lastCheckin && (
        <Card style={{ marginTop: "2rem", borderLeft: "4px solid var(--success)" }}>
          <h3 style={{ marginBottom: "0.5rem", color: "var(--success)" }}>✓ Check-in Recorded</h3>
          <p style={{ marginBottom: 0, color: "var(--text-secondary)" }}>
            You're building self-awareness, one check-in at a time. Keep going!
          </p>
        </Card>
      )}

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
