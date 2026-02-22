"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (!stored) {
      router.replace("/auth");
      return;
    }
    setToken(stored);
  }, [router]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/tasks/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const complete = async (taskId: string) => {
    await fetch(`${apiBase}/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Today's Tasks</h1>
        <button className="button" onClick={load} disabled={!token || loading} style={{ margin: 0 }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {tasks.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-tertiary)" }}>
          <p>No tasks available. Complete onboarding to generate your personalized plan.</p>
        </div>
      )}
      <ul className="list">
        {tasks.map((t) => (
          <li key={t.id} className="card" style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "18px" }}>{t.title}</strong>
                  <span className="pill" style={{ margin: 0 }}>{t.status}</span>
                </div>
                {t.details?.rationale && (
                  <p style={{ margin: "8px 0", fontSize: "14px" }}>{t.details.rationale}</p>
                )}
                <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: "var(--text-tertiary)" }}>
                  <span>XP: <strong style={{ color: "var(--primary)" }}>{t.xp}</strong></span>
                  {t.details?.est_time && <span>Time: {t.details.est_time}</span>}
                  {t.details?.difficulty && <span>Difficulty: {t.details.difficulty}</span>}
                </div>
              </div>
              {t.status !== "completed" && (
                <button className="button" onClick={() => complete(t.id)} style={{ margin: 0, whiteSpace: "nowrap" }}>
                  Complete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
