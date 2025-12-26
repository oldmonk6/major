"use client";

import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function ProgressPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const load = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/progress/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setSummary(data);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Progress Dashboard</h1>
        <button className="button" onClick={load} disabled={!token} style={{ margin: 0 }}>
          Refresh
        </button>
      </div>
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div className="card" style={{ textAlign: "center", background: "var(--bg-secondary)" }}>
            <div style={{ fontSize: "14px", color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total XP
            </div>
            <div style={{ fontSize: "36px", fontWeight: "800", background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {summary.total_xp}
            </div>
          </div>
          <div className="card" style={{ textAlign: "center", background: "var(--bg-secondary)" }}>
            <div style={{ fontSize: "14px", color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Completed Tasks
            </div>
            <div style={{ fontSize: "36px", fontWeight: "800", color: "var(--success)" }}>
              {summary.completed_tasks}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
              of {summary.total_tasks} total
            </div>
          </div>
          <div className="card" style={{ textAlign: "center", background: "var(--bg-secondary)" }}>
            <div style={{ fontSize: "14px", color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Streak
            </div>
            <div style={{ fontSize: "36px", fontWeight: "800", color: "var(--warning)" }}>
              {summary.streak_days}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
              days
            </div>
          </div>
        </div>
      )}
      {!summary && token && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-tertiary)" }}>
          <p>Click refresh to load your progress</p>
        </div>
      )}
    </div>
  );
}
