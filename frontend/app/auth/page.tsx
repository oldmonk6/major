"use client";

import React, { useState } from "react";

import { Button, Card, Input, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateForm = () => {
    if (!email || !password) {
      setError("Email and password are required");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    setError("");
    setSuccess("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Authentication failed");
        return;
      }

      localStorage.setItem("reclaim_token", data.token);
      localStorage.setItem("reclaim_user_id", data.user_id);
      setSuccess(mode === "login" ? "Signed in successfully. Redirecting..." : "Account created. Redirecting...");

      setTimeout(() => {
        window.location.href = "/onboard";
      }, 1200);
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page-shell medium">
      <section className="app-page-intro">
        <div className="app-page-intro-grid">
          <div className="app-page-intro-copy">
            <p className="landing-kicker">Access RECLAIM</p>
            <h1 style={{ marginBottom: "0.75rem" }}>
              {mode === "login" ? "Return to your recovery rhythm." : "Create a calmer place to begin again."}
            </h1>
            <p>
              The first screen should feel steady and trustworthy. Sign in to continue your plan or create an account to
              start building one that adapts with you.
            </p>
          </div>
          <div className="app-page-intro-side">
            <div className="app-page-chip-row">
              <span className="app-page-chip">Private by default</span>
              <span className="app-page-chip">Structured daily support</span>
            </div>
            <div className="app-panel soft" style={{ maxWidth: "320px" }}>
              <p className="app-stat-kicker">Demo access</p>
              <p style={{ margin: "0.35rem 0", color: "var(--text-primary)", fontWeight: 700 }}>test@example.com</p>
              <p className="app-note">password123</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="app-panel soft" style={{ marginBottom: 0 }}>
        <div className="app-segmented-row" style={{ marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`app-segmented-button${mode === "login" ? " active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`app-segmented-button${mode === "register" ? " active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
              setSuccess("");
            }}
          >
            Create account
          </button>
        </div>

        <div className="app-grid-2" style={{ marginBottom: "1rem" }}>
          <div>
            <label className="label">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={loading}
            />
          </div>
        </div>

        {mode === "register" && (
          <div style={{ marginBottom: "1rem" }}>
            <label className="label">Confirm Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <div className="app-panel critical" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
          </div>
        )}

        <Button
          onClick={handleAuth}
          disabled={loading}
          style={{ width: "100%", marginTop: "0.7rem", justifyContent: "center" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </span>
          ) : mode === "login" ? (
            "Continue to your plan"
          ) : (
            "Create your account"
          )}
        </Button>
      </Card>

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
