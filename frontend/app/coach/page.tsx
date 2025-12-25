"use client";

import React, { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function CoachPage() {
  const [token, setToken] = useState("");
  const [riskBucket, setRiskBucket] = useState("Low");
  const [lastTask, setLastTask] = useState("");
  const [streak, setStreak] = useState(0);
  const [flow, setFlow] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const start = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/coach/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          risk_bucket: riskBucket,
          last_task: lastTask,
          streak_days: streak,
        }),
      });
      const data = await res.json();
      setFlow(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Live AI Coach</h1>
      <label className="label">Risk bucket</label>
      <select className="input" value={riskBucket} onChange={(e) => setRiskBucket(e.target.value)}>
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      <label className="label">Last completed task</label>
      <input className="input" value={lastTask} onChange={(e) => setLastTask(e.target.value)} />
      <label className="label">Streak days</label>
      <input className="input" type="number" value={streak} onChange={(e) => setStreak(Number(e.target.value))} />
      <button className="button" onClick={start} disabled={loading}>
        {loading ? "Starting..." : "Start Coach Session"}
      </button>
      {flow?.steps && (
        <div className="card" style={{ marginTop: 12 }}>
          {flow.steps.map((s: any, idx: number) => (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div className="pill">{s.title}</div>
              <div>{s.instructions}</div>
              <div style={{ color: "#9fb3ff" }}>{s.suggested_duration_seconds}s</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
