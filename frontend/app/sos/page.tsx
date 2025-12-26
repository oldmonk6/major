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
    <div>
      <div className="card" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "var(--error)" }}>
        <h1 style={{ color: "var(--error)" }}>Crisis Support</h1>
        <p style={{ fontSize: "18px", lineHeight: "1.6", marginBottom: "24px" }}>
          You are not alone. If you're in crisis or need immediate support, help is available 24/7.
        </p>
        <div style={{
          background: "var(--surface)",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          border: "2px solid var(--error)"
        }}>
          <div style={{ fontSize: "14px", color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase" }}>
            Immediate Help
          </div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "var(--error)", marginBottom: "8px" }}>
            988
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            Call or text 988 for the Suicide & Crisis Lifeline (US)
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "14px", marginTop: "8px" }}>
            Available 24/7 for free, confidential support
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Send Alert to Support Network</h2>
        <p style={{ marginBottom: "16px" }}>
          Quickly notify your trusted contacts that you need support.
        </p>
        <label className="label">Your Message (Optional)</label>
        <textarea
          className="textarea"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="I'm struggling right now and could use some support..."
        />
        <button
          className="button"
          onClick={send}
          disabled={!token}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, var(--error) 0%, #dc2626 100%)",
            fontSize: "16px",
            padding: "14px"
          }}
        >
          Send Alert
        </button>
        {status && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: status.includes("sent") ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: status.includes("sent") ? "var(--success)" : "var(--error)",
            textAlign: "center",
            fontWeight: 600
          }}>
            {status}
          </div>
        )}
      </div>

      <div className="card" style={{ background: "var(--bg-secondary)" }}>
        <h3>Additional Resources</h3>
        <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
          <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "8px" }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              Crisis Text Line
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Text HOME to 741741
            </div>
          </div>
          <div style={{ padding: "12px", background: "var(--surface)", borderRadius: "8px" }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              SAMHSA National Helpline
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              1-800-662-4357 (treatment & referrals)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
