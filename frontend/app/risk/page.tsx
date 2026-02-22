"use client";

import React, { useState, useEffect } from "react";
import { SectionHeader, Card, Button, Input, Slider, EmptyState, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface RiskData {
  score: number;
  bucket: string;
  rationale: string;
}

interface JITData {
  event_id: string;
  chosen_action: string;
  instructions: string;
  why: string;
}

export default function RiskPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [jit, setJit] = useState<JITData | null>(null);
  const [reward, setReward] = useState(0.5);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const assessRisk = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/risk`, {
        headers: getAuthHeaders(token),
      });

      if (!res.ok) throw new Error("Failed to assess risk");

      const data = await res.json();
      setRisk(data);
      setJit(null);
      setFeedbackSent(false);
    } catch (err) {
      setError("Failed to assess risk. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getIntervention = async () => {
    if (!token || !risk) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/jitai/choose`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          risk_score: risk.score,
          risk_bucket: risk.bucket,
          recent_events: [],
          time_of_day: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to get intervention");

      const data = await res.json();
      setJit(data);
    } catch (err) {
      setError("Failed to get intervention. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async () => {
    if (!token || !jit) return;

    setError("");
    setFeedbackLoading(true);

    try {
      const res = await fetch(`${apiBase}/jitai/feedback`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          event_id: jit.event_id,
          reward,
        }),
      });

      if (!res.ok) throw new Error("Failed to send feedback");

      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    } catch (err) {
      setError("Failed to send feedback. Please try again.");
      console.error(err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getRiskColor = (bucket: string) => {
    switch (bucket?.toLowerCase()) {
      case "low":
        return "var(--success)";
      case "medium":
        return "var(--warning)";
      case "high":
        return "var(--error)";
      default:
        return "var(--primary-light)";
    }
  };

  if (!token) {
    return (
      <EmptyState
        icon="⚠️"
        title="Sign In Required"
        description="Please sign in to assess your risk level"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <SectionHeader
        title="Risk Assessment"
        subtitle="Check your current risk level and get personalized intervention support"
      />

      {!risk ? (
        <Card>
          <h2 style={{ marginBottom: "1rem" }}>Assess Your Risk Level</h2>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
            Understanding your current risk helps us provide targeted support and interventions
            when you need them most.
          </p>

          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                borderRadius: "0.5rem",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          <Button
            onClick={assessRisk}
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                Assessing...
              </span>
            ) : (
              "Assess My Risk"
            )}
          </Button>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            <Card>
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                  Risk Score
                </p>
                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${getRiskColor(risk.bucket)} 0%, ${getRiskColor(risk.bucket)} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {risk.score}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                  Risk Level
                </p>
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: 700,
                    color: getRiskColor(risk.bucket),
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {risk.bucket}
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ borderLeft: "4px solid var(--primary-light)", marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>Why This Risk Level?</h3>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{risk.rationale}</p>
          </Card>

          {!jit ? (
            <Card>
              <h2 style={{ marginBottom: "1rem" }}>Get Support</h2>
              <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                We can provide a personalized intervention to help you manage this moment.
              </p>
              <Button
                onClick={getIntervention}
                disabled={loading}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                    Finding Intervention...
                  </span>
                ) : (
                  "Get Intervention"
                )}
              </Button>
            </Card>
          ) : (
            <>
              <Card
                style={{
                  borderLeft: "4px solid var(--success)",
                  marginBottom: "1.5rem",
                }}
              >
                <h2 style={{ marginBottom: "1rem", color: "var(--success)" }}>
                  ✓ Recommended Action
                </h2>
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                    Action
                  </p>
                  <h3 style={{ margin: 0, color: "var(--primary-light)" }}>
                    {jit.chosen_action}
                  </h3>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                    Instructions
                  </p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    {jit.instructions}
                  </p>
                </div>

                <div
                  style={{
                    padding: "1rem",
                    background: "var(--bg-tertiary)",
                    borderRadius: "0.5rem",
                  }}
                >
                  <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                    Why This Helps
                  </p>
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>{jit.why}</p>
                </div>
              </Card>

              <Card>
                <h2 style={{ marginBottom: "1rem" }}>How Helpful Was This?</h2>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                  Your feedback helps us improve future interventions.
                </p>

                <Slider
                  value={reward}
                  onChange={setReward}
                  min={0}
                  max={1}
                  label="Rate helpfulness (0 = not helpful, 1 = very helpful)"
                />

                {error && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.75rem",
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid #ef4444",
                      borderRadius: "0.5rem",
                      color: "#ef4444",
                    }}
                  >
                    {error}
                  </div>
                )}

                <Button
                  onClick={sendFeedback}
                  disabled={feedbackLoading}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {feedbackLoading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                      Saving...
                    </span>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>

                {feedbackSent && (
                  <Toast
                    message="Thank you for the feedback! It helps us improve."
                    type="success"
                    onClose={() => setFeedbackSent(false)}
                  />
                )}
              </Card>

              <Button
                onClick={() => {
                  setRisk(null);
                  setJit(null);
                }}
                variant="secondary"
                style={{ width: "100%", marginTop: "1rem" }}
              >
                ← Assess Again
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
