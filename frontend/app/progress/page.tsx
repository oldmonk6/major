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
      <h1>Progress</h1>
      <button className="button" onClick={load} disabled={!token}>
        Refresh
      </button>
      {summary && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>Completed tasks: {summary.completed_tasks}</div>
          <div>Total tasks: {summary.total_tasks}</div>
          <div>Total XP: {summary.total_xp}</div>
          <div>Streak (placeholder): {summary.streak_days} days</div>
        </div>
      )}
    </div>
  );
}
