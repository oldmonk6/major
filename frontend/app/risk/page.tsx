"use client";

import React, { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function RiskPage() {
  const [token, setToken] = useState("");
  const [risk, setRisk] = useState<any>(null);
  const [jit, setJit] = useState<any>(null);
  const [reward, setReward] = useState<number>(1);
  const [feedbackStatus, setFeedbackStatus] = useState("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const assess = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/risk`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setRisk(data);
  };

  const intervene = async () => {
    if (!token || !risk) return;
    const res = await fetch(`${apiBase}/jitai/choose`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        risk_score: risk?.score,
        risk_bucket: risk?.bucket,
        recent_events: [],
        time_of_day: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    setJit(data);
  };

  return (
    <div className="card">
      <h1>Risk meter & JIT intervention</h1>
      <button className="button" onClick={assess} disabled={!token}>
        Assess risk
      </button>
      {risk && (
        <div className="card" style={{ marginTop: 12 }}>
          <div>Score: {risk.score}</div>
          <div>Bucket: {risk.bucket}</div>
          <div>Why: {risk.rationale}</div>
        </div>
      )}
      {risk && (
        <button className="button" onClick={intervene} style={{ marginTop: 12 }}>
          Get JIT intervention
        </button>
      )}
      {jit && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="pill">{jit.chosen_action}</div>
          <div>{jit.instructions}</div>
          <div style={{ color: "#9fb3ff" }}>{jit.why}</div>
          <div style={{ marginTop: 8 }}>
            <label className="label">Feedback (0-1 reward)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={reward}
              onChange={(e) => setReward(Number(e.target.value))}
            />
            <button
              className="button"
              onClick={async () => {
                setFeedbackStatus("Sending...");
                const res = await fetch(`${apiBase}/jitai/feedback`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ event_id: jit.event_id, reward }),
                });
                const data = await res.json();
                setFeedbackStatus(res.ok ? "Feedback recorded" : data.detail || "Error");
              }}
            >
              Send feedback
            </button>
            {feedbackStatus && <p>{feedbackStatus}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
