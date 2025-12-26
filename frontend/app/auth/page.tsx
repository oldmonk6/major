"use client";

import React, { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    const uid = localStorage.getItem("reclaim_user_id");
    if (stored) setToken(stored);
    if (uid) setUserId(uid);
  }, []);

  const handle = async (path: "register" | "login") => {
    setStatus("Working...");
    try {
      const res = await fetch(`${apiBase}/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUserId(data.user_id);
        localStorage.setItem("reclaim_token", data.token);
        localStorage.setItem("reclaim_user_id", data.user_id);
        setStatus("Success");
      } else {
        setStatus(data.detail || "Error");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div className="card">
        <h1>Authentication</h1>
        <p style={{ marginBottom: "24px" }}>Sign in or create an account to access your recovery journey.</p>

        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />

        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button className="button" onClick={() => handle("register")} style={{ flex: 1 }}>
            Register
          </button>
          <button className="button" onClick={() => handle("login")} style={{ flex: 1 }}>
            Login
          </button>
        </div>

        {status && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: status === "Success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: status === "Success" ? "var(--success)" : "var(--error)",
            textAlign: "center",
            fontWeight: 600
          }}>
            {status}
          </div>
        )}

        {token && (
          <div className="card" style={{ marginTop: "16px", background: "var(--bg-secondary)" }}>
            <div style={{ fontSize: "14px", color: "var(--success)", marginBottom: "8px", fontWeight: 600 }}>
              Authenticated Successfully
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
              User ID: <code style={{ color: "var(--primary)" }}>{userId}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
