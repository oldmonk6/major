"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader, Card, Button, EmptyState } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface Task {
  id: string;
  title: string;
  status: "pending" | "completed";
  xp: number;
  details?: {
    rationale: string;
    est_time?: string;
    difficulty?: string;
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [completingId, setCompletingId] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const loadTasks = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/tasks/today`, {
        headers: getAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError("Failed to load tasks. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      const res = await fetch(`${apiBase}/tasks/${taskId}/complete`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to complete task");
      await loadTasks();
    } catch (err) {
      setError("Failed to complete task. Please try again.");
      console.error(err);
    } finally {
      setCompletingId("");
    }
  };

  useEffect(() => {
    loadTasks();
  }, [token]);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalXP = tasks.reduce((sum, t) => sum + (t.xp || 0), 0);

  if (!token) {
    return (
      <EmptyState
        icon="🔒"
        title="Sign In Required"
        description="Please sign in to view your tasks"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div>
      <SectionHeader
        title="Today's Tasks"
        subtitle="Complete your daily recovery activities to build momentum"
      />

      {/* Stats */}
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
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--primary-light)" }}>
              {completedCount}/{tasks.length}
            </div>
            <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Tasks Completed</p>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--success)" }}>
              {totalXP}
            </div>
            <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Experience Points</p>
          </div>
        </Card>
      </div>

      {error && (
        <Card style={{ borderLeft: "4px solid var(--error)", background: "rgba(239, 68, 68, 0.1)" }}>
          <p style={{ color: "var(--error)", margin: 0 }}>{error}</p>
        </Card>
      )}

      {tasks.length === 0 && !loading ? (
        <EmptyState
          icon="📋"
          title="No Tasks Yet"
          description="Complete onboarding to generate your personalized recovery plan and see tasks here"
          action={{
            label: "Start Onboarding",
            onClick: () => (window.location.href = "/onboard"),
          }}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ margin: 0 }}>Your Daily Activities</h2>
            <Button
              onClick={loadTasks}
              disabled={loading}
              variant="secondary"
              size="sm"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div
            style={{
              display: "grid",
              gap: "1rem",
            }}
          >
            {tasks.map((task) => (
              <Card
                key={task.id}
                style={{
                  borderLeft: `4px solid ${
                    task.status === "completed" ? "var(--success)" : "var(--primary-light)"
                  }`,
                  opacity: task.status === "completed" ? 0.7 : 1,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "1.5rem",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <h3 style={{ margin: 0 }}>{task.title}</h3>
                      {task.status === "completed" && (
                        <span style={{ fontSize: "1.5rem" }}>✓</span>
                      )}
                      <span className="pill" style={{ fontSize: "0.85rem" }}>
                        {task.status === "completed" ? "Completed" : "Pending"}
                      </span>
                    </div>

                    {task.details?.rationale && (
                      <p style={{ marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
                        {task.details.rationale}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
                      <div>
                        <span style={{ color: "var(--text-tertiary)" }}>Experience: </span>
                        <strong style={{ color: "var(--success)" }}>{task.xp || 0} XP</strong>
                      </div>
                      {task.details?.est_time && (
                        <div>
                          <span style={{ color: "var(--text-tertiary)" }}>Time: </span>
                          <strong>{task.details.est_time}</strong>
                        </div>
                      )}
                      {task.details?.difficulty && (
                        <div>
                          <span style={{ color: "var(--text-tertiary)" }}>Difficulty: </span>
                          <strong>{task.details.difficulty}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {task.status !== "completed" && (
                    <Button
                      onClick={() => completeTask(task.id)}
                      disabled={completingId === task.id}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {completingId === task.id ? "Marking..." : "Complete"}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
