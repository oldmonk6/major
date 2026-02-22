"use client";

import React, { useState, useEffect } from "react";
import { SectionHeader, Card, Button, Input, EmptyState, Skeleton } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface Step {
  title: string;
  instructions: string;
  suggested_duration_seconds: number;
}

export default function CoachPage() {
  const [token, setToken] = useState("");
  const [riskBucket, setRiskBucket] = useState("Low");
  const [lastTask, setLastTask] = useState("");
  const [streak, setStreak] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const startSession = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setError("");
    setLoading(true);
    setSessionActive(true);

    try {
      const res = await fetch(`${apiBase}/coach/session`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          risk_bucket: riskBucket,
          last_task: lastTask,
          streak_days: streak,
        }),
      });

      if (!res.ok) throw new Error("Failed to start session");

      const data = await res.json();
      setSteps(data.steps || []);
    } catch (err) {
      setError("Failed to start coaching session. Please try again.");
      console.error(err);
      setSessionActive(false);
    } finally {
      setLoading(false);
    }
  };

  const endSession = () => {
    setSessionActive(false);
    setSteps([]);
    setRiskBucket("Low");
    setLastTask("");
    setStreak(0);
  };

  if (!token) {
    return (
      <EmptyState
        icon="🤖"
        title="Sign In Required"
        description="Please sign in to start an AI coaching session"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <SectionHeader
        title="AI Coach Session"
        subtitle="Get personalized guidance and support from your AI coach"
      />

      {!sessionActive ? (
        <Card>
          <h2 style={{ marginBottom: "1rem" }}>Start a Coaching Session</h2>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
            Tell us about your current situation and we'll provide personalized guidance.
          </p>

          <div>
            <label className="label">Current Risk Level</label>
            <select
              value={riskBucket}
              onChange={(e) => setRiskBucket(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "1rem",
                cursor: "pointer",
                marginBottom: "1rem",
                outline: "none",
              }}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <label className="label">Last Task You Completed</label>
            <Input
              value={lastTask}
              onChange={(e) => setLastTask(e.target.value)}
              placeholder="e.g., meditation, journaling, took a walk"
            />

            <label className="label">Current Streak (Days)</label>
            <Input
              type="number"
              value={streak.toString()}
              onChange={(e) => setStreak(Math.max(0, Number(e.target.value)))}
              placeholder="0"
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
            onClick={startSession}
            disabled={loading}
            style={{ width: "100%", marginTop: "1.5rem", justifyContent: "center" }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                Starting Session...
              </span>
            ) : (
              "Start Session"
            )}
          </Button>
        </Card>
      ) : (
        <>
          <div style={{ marginBottom: "1.5rem" }}>
            <Button
              onClick={endSession}
              variant="secondary"
              style={{ marginBottom: "1.5rem" }}
            >
              ← End Session
            </Button>
          </div>

          {loading ? (
            <Card>
              <Skeleton height="2rem" style={{ marginBottom: "1rem" }} />
              <Skeleton height="1rem" />
              <Skeleton height="1rem" />
              <Skeleton height="1rem" />
            </Card>
          ) : steps.length === 0 ? (
            <Card>
              <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                No guidance available. Please try again.
              </p>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {steps.map((step, idx) => {
                const duration = Math.floor(step.suggested_duration_seconds / 60);
                const seconds = step.suggested_duration_seconds % 60;

                return (
                  <Card
                    key={idx}
                    style={{
                      borderLeft: "4px solid var(--primary-light)",
                      animation: "slideUp 0.3s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "start", gap: "1rem" }}>
                      <div
                        style={{
                          minWidth: "3rem",
                          height: "3rem",
                          borderRadius: "0.5rem",
                          background: "var(--bg-tertiary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "var(--primary-light)",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: "0.5rem" }}>{step.title}</h3>
                        <p style={{ marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                          {step.instructions}
                        </p>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "0.5rem 1rem",
                            background: "var(--bg-tertiary)",
                            borderRadius: "0.375rem",
                            fontSize: "0.9rem",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          ⏱ {duration > 0 ? `${duration}m ` : ""}{seconds}s
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Card style={{ borderLeft: "4px solid var(--success)" }}>
                <h3 style={{ color: "var(--success)", marginBottom: "0.5rem" }}>Ready?</h3>
                <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                  Work through these steps at your own pace. There's no rush—focus on what works for
                  you.
                </p>
                <Button onClick={endSession} variant="secondary">
                  Done with Session
                </Button>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
