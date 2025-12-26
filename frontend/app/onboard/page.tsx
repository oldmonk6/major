"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function OnboardPage() {
  const router = useRouter();
  const [addiction, setAddiction] = useState("");
  const [triggers, setTriggers] = useState("");
  const [goals, setGoals] = useState("");
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    const uid = localStorage.getItem("reclaim_user_id");
    if (!stored) {
      router.replace("/auth");
      return;
    }
    setToken(stored);
    if (uid) setUserId(uid);
  }, [router]);

  const submit = async () => {
    if (!token) {
      setStatus("Please sign in first.");
      router.replace("/auth");
      return;
    }
    setLoading(true);
    setStatus("Generating plan...");
    try {
      const res = await fetch(`${apiBase}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          addiction,
          triggers: triggers.split(",").map((t) => t.trim()).filter(Boolean),
          goals: goals.split(",").map((t) => t.trim()).filter(Boolean),
          constraints: constraints.split(",").map((t) => t.trim()).filter(Boolean),
          preferences: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.detail || "Error generating plan");
        return;
      }
      setPlan(data.plan);
      setUserId(data.user_id);
      setStatus("Plan ready");
    } catch (err) {
      console.error(err);
      setStatus("Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Onboarding</h1>
      <label className="label">Addiction</label>
      <input className="input" value={addiction} onChange={(e) => setAddiction(e.target.value)} placeholder="e.g. nicotine" />
      <label className="label">Triggers (comma separated)</label>
      <input className="input" value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder="stress, social settings" />
      <label className="label">Goals (comma separated)</label>
      <input className="input" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="30-day abstinence, better sleep" />
      <label className="label">Constraints (comma separated)</label>
      <input className="input" value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="no long sessions, only mornings" />
      <button className="button" onClick={submit} disabled={loading}>
        {loading ? "Generating plan..." : "Generate Plan"}
      </button>
      {status && <p>{status}</p>}
      {userId && <p>Your user ID: {userId}</p>}
      {plan && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Plan (day 1 tasks seeded)</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
