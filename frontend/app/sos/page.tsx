"use client";

import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function SOSPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const send = async () => {
    if (!token) {
      setStatus("Login first");
      return;
    }
    setStatus("Sending...");
    try {
      const res = await fetch(`${apiBase}/sos/alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "sos", message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.detail || "Error");
      } else {
        setStatus(`Alert sent (${data.alert_id})`);
      }
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  return (
    <div className="card">
      <h1>SOS / Helpline</h1>
      <p>If you feel at risk, send a quick alert to your trusted contacts or show helpline info.</p>
      <label className="label">Message</label>
      <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      <button className="button" onClick={send}>Send alert</button>
      {status && <p>{status}</p>}
      <div className="card" style={{ marginTop: 12, background: "#2a1f2f" }}>
        <strong>Helpline</strong>
        <div>Call 988 (US) or your local crisis line.</div>
      </div>
    </div>
  );
}
