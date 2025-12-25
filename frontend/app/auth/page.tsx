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
    <div className="card">
      <h1>Auth</h1>
      <label className="label">Email</label>
      <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="label">Password</label>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="button" onClick={() => handle("register")}>Register</button>
        <button className="button" onClick={() => handle("login")}>Login</button>
      </div>
      {status && <p>{status}</p>}
      {token && (
        <div style={{ marginTop: 8 }}>
          <div>Token saved locally.</div>
          <div>User ID: {userId}</div>
        </div>
      )}
    </div>
  );
}
