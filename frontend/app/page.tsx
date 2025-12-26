"use client";

import React, { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function OnboardPage() {
  const [addiction, setAddiction] = useState("");
  const [triggers, setTriggers] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    const uid = localStorage.getItem("reclaim_user_id");
    if (stored) setToken(stored);
    if (uid) setUserId(uid);
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(token ? { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify({
          addiction,
          triggers: triggers.split(",").map((t) => t.trim()).filter(Boolean),
          goals: goals.split(",").map((t) => t.trim()).filter(Boolean),
          constraints: constraints.split(",").map((t) => t.trim()).filter(Boolean),
          preferences: {},
        }),
      });
      const data = await res.json();
      setPlan(data.plan);
      setUserId(data.user_id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h1>Personalized Recovery Plan</h1>
        <p style={{ marginBottom: "24px" }}>
          Tell us about your journey so we can create a tailored recovery plan just for you.
        </p>

        <label className="label">What are you recovering from?</label>
        <input
          className="input"
          value={addiction}
          onChange={(e) => setAddiction(e.target.value)}
          placeholder="e.g., nicotine, alcohol, gaming"
        />

        <label className="label">Common Triggers</label>
        <input
          className="input"
          value={triggers}
          onChange={(e) => setTriggers(e.target.value)}
          placeholder="e.g., stress, social settings, boredom"
        />

        <label className="label">Your Goals</label>
        <input
          className="input"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g., 30-day abstinence, better sleep, improved health"
        />

        <label className="label">Any Constraints?</label>
        <input
          className="input"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="e.g., limited time, prefer morning activities"
        />

        <button
          className="button"
          onClick={submit}
          disabled={loading || !addiction}
          style={{ width: "100%", fontSize: "16px", padding: "14px" }}
        >
          {loading ? "Generating your personalized plan..." : "Generate My Recovery Plan"}
        </button>

        {userId && !plan && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(6, 182, 212, 0.1)",
            color: "var(--primary)",
            textAlign: "center",
            fontSize: "14px"
          }}>
            Plan generated for user: <code>{userId}</code>
          </div>
        )}
      </div>

      {plan && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }}>Your Recovery Plan</h2>
            <span className="pill" style={{ margin: 0 }}>Day 1 tasks ready</span>
          </div>
          <p style={{ marginBottom: "16px" }}>
            Your personalized recovery plan has been generated. Check the Tasks page to see your daily activities.
          </p>
          <details style={{ marginTop: "16px" }}>
            <summary style={{
              cursor: "pointer",
              padding: "12px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              fontWeight: 600,
              color: "var(--text-secondary)"
            }}>
              View full plan details
            </summary>
            <pre style={{ marginTop: "12px" }}>{JSON.stringify(plan, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
