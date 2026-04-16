"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { CommunityPulseCard } from "@/components/community-pulse-card";
import { StickmanJourneyCard } from "@/components/stickman-journey-card";
import { SectionHeader, Card, Button, EmptyState } from "@/components/ui";
import { sampleTasks } from "@/lib/avatar-journey";
import { getAuthHeaders } from "@/lib/utils";
import { useAvatarJourney } from "@/lib/use-avatar-journey";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface Task {
  id: string;
  title: string;
  status: "pending" | "completed";
  xp: number;
  day_index?: number;
  week_index?: number;
  day_in_week?: number;
  details?: {
    rationale: string;
    est_time?: string;
    difficulty?: string;
  };
}

interface ProgressSummary {
  cravings_logged: number;
  cravings_resisted: number;
  slips_logged: number;
  patterns?: {
    top_trigger: string;
    top_time_window: string;
    top_location: string;
  };
}

interface RiskSnapshot {
  score: number;
  bucket: string;
  rationale: string;
}

interface EmergencyPlanSnapshot {
  plan?: {
    danger_hours?: string[];
    replacement_actions?: string[];
    reasons_to_quit?: string[];
  };
}

const weekDayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("guest");
  const [completingId, setCompletingId] = useState<string>("");
  const [walking, setWalking] = useState(false);
  const [weekIndex, setWeekIndex] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [weekComplete, setWeekComplete] = useState(false);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [risk, setRisk] = useState<RiskSnapshot | null>(null);
  const [emergencyPlan, setEmergencyPlan] = useState<EmergencyPlanSnapshot["plan"] | null>(null);
  const mountedRef = useRef(false);
  const previousCompletedRef = useRef(0);

  useEffect(() => {
    const storedToken = localStorage.getItem("reclaim_token");
    const storedUserId = localStorage.getItem("reclaim_user_id");
    if (storedToken) setToken(storedToken);
    if (storedUserId) setUserId(storedUserId);
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
      setWeekIndex(data.week_index || 1);
      setTotalWeeks(data.total_weeks || 0);
      setWeekComplete(Boolean(data.week_complete));
    } catch (err) {
      setError("Failed to load tasks. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecoveryContext = async () => {
    if (!token) return;
    try {
      const [summaryRes, riskRes, planRes] = await Promise.all([
        fetch(`${apiBase}/progress/summary`, { headers: getAuthHeaders(token) }),
        fetch(`${apiBase}/risk`, { headers: getAuthHeaders(token) }),
        fetch(`${apiBase}/emergency-plan`, { headers: getAuthHeaders(token) }),
      ]);
      const summaryData = await summaryRes.json().catch(() => null);
      const riskData = await riskRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);
      if (summaryRes.ok) setSummary(summaryData);
      if (riskRes.ok) setRisk(riskData);
      if (planRes.ok) setEmergencyPlan(planData.plan || null);
    } catch (err) {
      console.error(err);
    }
  };

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "completed").length,
    [tasks]
  );
  const totalXP = useMemo(
    () => tasks.reduce((sum, task) => sum + (task.xp || 0), 0),
    [tasks]
  );
  const previewTasks = tasks.length > 0 ? tasks : sampleTasks;
  const previewCompletedCount = previewTasks.filter((task) => task.status === "completed").length;
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.day_in_week || 0) - (b.day_in_week || 0)),
    [tasks]
  );

  const { displayProgress, celebrate } = useAvatarJourney({
    userId,
    completedTasks: completedCount,
    totalTasks: tasks.length,
  });

  useEffect(() => {
    loadTasks();
    loadRecoveryContext();
  }, [token]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousCompletedRef.current = completedCount;
      return;
    }

    if (completedCount <= previousCompletedRef.current) {
      previousCompletedRef.current = completedCount;
      return;
    }

    previousCompletedRef.current = completedCount;
    setWalking(true);
    const timeout = window.setTimeout(() => setWalking(false), 1100);
    return () => window.clearTimeout(timeout);
  }, [completedCount]);

  const completeTask = async (taskId: string) => {
    setCompletingId(taskId);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: "completed" } : task
      )
    );

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
      await loadTasks();
    } finally {
      setCompletingId("");
    }
  };

  if (!token) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <EmptyState
          icon="🔒"
          title="Sign In Required"
          description="Please sign in to view your tasks"
          action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
        />
        <CommunityPulseCard />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={`Week ${weekIndex} Tasks`}
        subtitle="Complete the current week and the next one opens automatically. Progress is shown as a clean horizontal walk tied directly to finished tasks."
      />

      <div className="task-hero-grid">
        <StickmanJourneyCard
          progress={displayProgress}
          completedTasks={completedCount}
          totalTasks={tasks.length}
          walking={walking}
          celebrate={celebrate}
        />
        <CommunityPulseCard />
      </div>

      <div className="recovery-grid-main" style={{ marginBottom: "1.4rem" }}>
        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Recovery Context</p>
              <h3>Keep the weekly plan inside the real recovery picture.</h3>
            </div>
            <p>Tasks work better when risk, triggers, and fallback actions stay visible.</p>
          </div>
          <div className="recovery-pattern-grid">
            <div>
              <span>Live risk</span>
              <strong>{risk ? `${risk.bucket} (${risk.score})` : "Loading"}</strong>
            </div>
            <div>
              <span>Top trigger</span>
              <strong>{summary?.patterns?.top_trigger || "Not enough data"}</strong>
            </div>
            <div>
              <span>Hardest time</span>
              <strong>{summary?.patterns?.top_time_window || "Not enough data"}</strong>
            </div>
            <div>
              <span>Cravings resisted</span>
              <strong>{summary?.cravings_resisted ?? 0}</strong>
            </div>
          </div>
          <div className="recovery-mini-log">
            <p>{risk?.rationale || "Risk context will appear here once the latest signals are loaded."}</p>
          </div>
        </div>

        <aside className="recovery-sidebar">
          <div className="recovery-intervention-panel">
            <p className="journey-kicker">If the day gets harder</p>
            <h3>Use your fallback before the spiral grows.</h3>
            <div className="recovery-intervention-list">
              {(emergencyPlan?.replacement_actions || []).slice(0, 3).map((item) => (
                <div key={item}>{item}</div>
              ))}
              {(!emergencyPlan?.replacement_actions || emergencyPlan.replacement_actions.length === 0) && (
                <div>Add replacement actions in Recovery so they appear here during the week.</div>
              )}
            </div>
            {!!emergencyPlan?.danger_hours?.length && (
              <p className="app-note" style={{ marginTop: "0.8rem" }}>
                Watch the following windows closely: {emergencyPlan.danger_hours.join(", ")}.
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="task-stat-grid">
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--primary)" }}>
              {completedCount}/{tasks.length}
            </div>
            <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Days Completed This Week</p>
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
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--warning)" }}>
              {Math.round(displayProgress * 100)}%
            </div>
            <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Current Week Completion</p>
          </div>
        </Card>
      </div>

      {error && (
        <Card style={{ borderLeft: "4px solid var(--error)", background: "rgba(var(--error-rgb), 0.1)" }}>
          <p style={{ color: "var(--error)", margin: 0 }}>{error}</p>
        </Card>
      )}

      {tasks.length === 0 && !loading ? (
        <div className="task-empty-layout">
          <EmptyState
            icon="📋"
            title="No Tasks Yet"
            description="Complete onboarding to generate your personalized recovery plan and see tasks here"
            action={{
              label: "Start Onboarding",
              onClick: () => (window.location.href = "/onboard"),
            }}
          />
          <Card className="task-preview-card">
            <p className="journey-kicker">Premium Preview</p>
            <h3>How the animated task walk feels</h3>
            <p className="journey-subtitle">
              Even before live data arrives, the UI keeps the same clear rhythm: a horizontal route,
              readable milestones, and a walking stickman that moves forward as tasks are closed.
            </p>
            <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.1rem" }}>
              {previewTasks.map((task) => (
                <div key={task.id} className="task-preview-item">
                  <span>{task.title}</span>
                  <span>{task.status === "completed" ? "Complete" : "Up next"}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "1rem", color: "var(--text-tertiary)" }}>
              Preview progress: {previewCompletedCount}/{previewTasks.length}
            </p>
          </Card>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Your Weekly Activities</h2>
              <p style={{ margin: "0.35rem 0 0 0", color: "var(--text-tertiary)" }}>
                Complete all 7 days in week {weekIndex} to unlock week {Math.min(weekIndex + 1, Math.max(totalWeeks, weekIndex + 1))}.
              </p>
            </div>
            <Button onClick={loadTasks} disabled={loading} variant="secondary" size="sm">
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p className="journey-kicker" style={{ marginBottom: "0.35rem" }}>Weekly Unlock</p>
                <h3 style={{ margin: 0 }}>Week {weekIndex} of {Math.max(totalWeeks, weekIndex)}</h3>
              </div>
              <p style={{ margin: 0, color: weekComplete ? "var(--success)" : "var(--text-secondary)" }}>
                {weekComplete ? "This week is complete. Refresh to load the next unlocked week." : "Next week remains locked until every day in this week is done."}
              </p>
            </div>
          </Card>

          <div style={{ display: "grid", gap: "1rem" }}>
            {sortedTasks.map((task) => (
              <Card
                key={task.id}
                className="task-premium-card"
                style={{
                  borderLeft: `4px solid ${
                    task.status === "completed" ? "var(--success)" : "var(--primary-light)"
                  }`,
                  opacity: task.status === "completed" ? 0.76 : 1,
                }}
              >
                <div className="task-premium-grid">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                      <span className="pill" style={{ fontSize: "0.85rem" }}>
                        {weekDayLabels[(task.day_in_week || 1) - 1] || `Day ${task.day_in_week || 1}`}
                      </span>
                      <h3 style={{ margin: 0 }}>{task.title}</h3>
                      {task.status === "completed" && <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Done</span>}
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
                      {completingId === task.id ? "Climbing..." : "Complete"}
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
