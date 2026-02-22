"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader, Card, Button, EmptyState, Skeleton, ProgressBar } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface ProgressData {
  total_xp: number;
  completed_tasks: number;
  total_tasks: number;
  streak_days: number;
}

export default function ProgressPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const loadProgress = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/progress/summary`, {
        headers: getAuthHeaders(token),
      });

      if (!res.ok) throw new Error("Failed to load progress");

      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setError("Failed to load progress. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadProgress();
    }
  }, [token]);

  if (!token) {
    return (
      <EmptyState
        icon="📊"
        title="Sign In Required"
        description="Please sign in to view your recovery progress"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div>
      <SectionHeader
        title="Your Recovery Journey"
        subtitle="Track your progress and celebrate your achievements"
      />

      {error && (
        <Card style={{ borderLeft: "4px solid var(--error)", background: "rgba(239, 68, 68, 0.1)" }}>
          <p style={{ color: "var(--error)", margin: 0 }}>{error}</p>
        </Card>
      )}

      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton height="2rem" style={{ marginBottom: "1rem" }} />
              <Skeleton height="3rem" />
            </Card>
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            <Card>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-tertiary)",
                    margin: "0 0 0.75rem 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total Experience
                </p>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {summary.total_xp}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0 0" }}>
                  XP earned
                </p>
              </div>
            </Card>

            <Card>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-tertiary)",
                    margin: "0 0 0.75rem 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Tasks Completed
                </p>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    color: "var(--success)",
                  }}
                >
                  {summary.completed_tasks}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0 0" }}>
                  of {summary.total_tasks} total
                </p>
              </div>
            </Card>

            <Card>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-tertiary)",
                    margin: "0 0 0.75rem 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Current Streak
                </p>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    color: "var(--warning)",
                  }}
                >
                  {summary.streak_days}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0.5rem 0 0 0" }}>
                  days in a row
                </p>
              </div>
            </Card>
          </div>

          {/* Progress Bars */}
          <Card style={{ marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Task Progress</h2>
            <ProgressBar
              current={summary.completed_tasks}
              total={summary.total_tasks}
              label="Tasks Completed"
            />

            <div
              style={{
                padding: "1rem",
                background: "var(--bg-tertiary)",
                borderRadius: "0.5rem",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  fontSize: "0.95rem",
                  lineHeight: "1.6",
                }}
              >
                You're making great progress! Keep going. Every task completed brings you closer to
                your recovery goals.
              </p>
            </div>
          </Card>

          {/* Streak Milestone */}
          {summary.streak_days > 0 && (
            <Card
              style={{
                borderLeft: "4px solid var(--warning)",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)",
              }}
            >
              <h2 style={{ marginBottom: "0.5rem", color: "var(--warning)" }}>
                🔥 Amazing Streak!
              </h2>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                You've been on a {summary.streak_days}-day streak. That's incredible dedication to
                your recovery. Keep this momentum going!
              </p>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          icon="📈"
          title="No Progress Data Yet"
          description="Start completing tasks to see your progress here"
          action={{
            label: "Go to Tasks",
            onClick: () => (window.location.href = "/tasks"),
          }}
        />
      )}

      <div style={{ marginTop: "2rem" }}>
        <Button
          onClick={loadProgress}
          disabled={loading}
          variant="secondary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {loading ? "Refreshing..." : "Refresh Progress"}
        </Button>
      </div>
    </div>
  );
}
