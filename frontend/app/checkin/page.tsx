"use client";

import React, { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function CheckInPage() {
  const [token, setToken] = useState("");
  const [craving, setCraving] = useState(0);
  const [mood, setMood] = useState("");
  const [triggers, setTriggers] = useState("");
  const [urge, setUrge] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState("");

  React.useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const submit = async () => {
    if (!token) {
      setStatus("Login first");
      return;
    }
    setStatus("Saving...");
    try {
      const res = await fetch(`${apiBase}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          craving,
          mood,
          triggers: triggers.split(",").map((t) => t.trim()).filter(Boolean),
          urge,
        }),
      });
      const data = await res.json();
      setStatus(`Saved check-in ${data.id || ""}`);
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  return (
    <div className="card">
      <h1>Daily 30-second check-in</h1>
      <label className="label">Craving (0-10)</label>
      <input className="input" type="number" value={craving} onChange={(e) => setCraving(Number(e.target.value))} />
      <label className="label">Urge (0-10)</label>
      <input className="input" type="number" value={urge ?? ""} onChange={(e) => setUrge(Number(e.target.value))} />
      <label className="label">Mood</label>
      <input className="input" value={mood} onChange={(e) => setMood(e.target.value)} />
      <label className="label">Triggers (comma separated)</label>
      <input className="input" value={triggers} onChange={(e) => setTriggers(e.target.value)} />
      <button className="button" onClick={submit}>
        Submit
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}
