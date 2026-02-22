"use client";

import React, { useState } from "react";
import { Card, Input, Button, Toast } from "@/components/ui";
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
        setError(data.error || "Authentication failed");
        return;
      }

      localStorage.setItem("reclaim_token", data.token);
      localStorage.setItem("reclaim_user_id", data.user_id);
      setSuccess(
        mode === "login"
          ? "Signed in successfully! Redirecting..."
          : "Account created! Redirecting..."
      );

      setTimeout(() => {
        window.location.href = "/onboard";
      }, 1500);
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", paddingTop: "2rem" }}>
      <Card>
        <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h1>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
          {mode === "login"
            ? "Sign in to access your recovery plan"
            : "Start your recovery journey with RECLAIM"}
        </p>

        <label className="label">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={loading}
        />

        <label className="label">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          disabled={loading}
        />

        {mode === "register" && (
          <>
            <label className="label">Confirm Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
            />
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#ef4444",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <Button
          onClick={handleAuth}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "1.5rem",
            marginBottom: "1rem",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </span>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </Button>

        <div style={{ textAlign: "center" }}>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}
          </p>
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setEmail("");
              setPassword("");
              setConfirmPassword("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary-light)",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </Card>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
          💡 Demo credentials: test@example.com / password123
        </p>
      </div>

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
