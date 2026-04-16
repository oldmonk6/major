"use client";

import React, { useEffect, useState } from "react";

import { Button, EmptyState, SectionHeader, Slider, Toast } from "@/components/ui";
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
        return "var(--primary)";
    }
  };

  if (!token) {
    return (
      <EmptyState
        icon="⚠"
        title="Sign In Required"
        description="Please sign in to assess your risk level"
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className="app-page-shell">
      <section className="app-page-intro">
        <div className="app-page-intro-grid">
          <div className="app-page-intro-copy">
            <SectionHeader
              title="Risk Assessment"
              subtitle="The page should explain risk calmly, show what matters, and lead directly to a useful action."
            />
          </div>
          <div className="app-page-intro-side">
            <div className="app-page-chip-row">
              <span className="app-page-chip">Signal-based support</span>
              <span className="app-page-chip">Intervention on demand</span>
            </div>
          </div>
        </div>
      </section>

      {!risk ? (
        <div className="app-panel soft">
          <p className="landing-kicker">Assessment</p>
          <h2 style={{ marginBottom: "0.75rem" }}>Check your current support level</h2>
          <p style={{ marginBottom: "1rem" }}>
            We use recent signals to estimate whether the next stretch of time looks steady, uncertain, or high-friction.
          </p>
          {error && (
            <div className="app-panel critical" style={{ marginBottom: "1rem" }}>
              <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
            </div>
          )}
          <Button onClick={assessRisk} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                Assessing...
              </span>
            ) : (
              "Assess My Risk"
            )}
          </Button>
        </div>
      ) : (
        <>
          <section className="app-stat-grid">
            <div className="app-stat-card">
              <p className="app-stat-kicker">Risk Score</p>
              <div className="app-stat-value" style={{ color: getRiskColor(risk.bucket) }}>
                {risk.score}
              </div>
              <p className="app-stat-note">Current numerical estimate</p>
            </div>
            <div className="app-stat-card">
              <p className="app-stat-kicker">Risk Level</p>
              <div className="app-stat-value" style={{ color: getRiskColor(risk.bucket), textTransform: "uppercase" }}>
                {risk.bucket}
              </div>
              <p className="app-stat-note">Support intensity right now</p>
            </div>
            <div className="app-stat-card">
              <p className="app-stat-kicker">Next Move</p>
              <div className="app-stat-value" style={{ fontSize: "1.8rem", color: "var(--text-primary)" }}>
                {jit ? "Action ready" : "Get support"}
              </div>
              <p className="app-stat-note">Use an intervention matched to this moment</p>
            </div>
          </section>

          <div className="app-panel">
            <p className="landing-kicker">Why this level</p>
            <p style={{ margin: 0 }}>{risk.rationale}</p>
          </div>

          {!jit ? (
            <div className="app-panel soft">
              <p className="landing-kicker">Intervention</p>
              <h3 style={{ marginBottom: "0.6rem" }}>Get a guided next step</h3>
              <p style={{ marginBottom: "1rem" }}>
                When the page identifies a harder window, the next action should feel immediate and practical.
              </p>
              <Button onClick={getIntervention} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                    Finding intervention...
                  </span>
                ) : (
                  "Get Intervention"
                )}
              </Button>
            </div>
          ) : (
            <section className="app-grid-2">
              <div className="app-panel success">
                <p className="landing-kicker">Recommended Action</p>
                <h3 style={{ marginBottom: "0.65rem", color: "var(--success)" }}>{jit.chosen_action}</h3>
                <p style={{ marginBottom: "0.9rem" }}>{jit.instructions}</p>
                <div className="app-panel" style={{ marginTop: "0.8rem" }}>
                  <p className="app-stat-kicker">Why this helps</p>
                  <p style={{ margin: "0.35rem 0 0 0" }}>{jit.why}</p>
                </div>
              </div>

              <div className="app-panel">
                <p className="landing-kicker">Feedback</p>
                <h3 style={{ marginBottom: "0.55rem" }}>How helpful was that?</h3>
                <p style={{ marginBottom: "1rem" }}>Your rating helps future interventions become more relevant.</p>
                <Slider
                  value={reward}
                  onChange={setReward}
                  min={0}
                  max={1}
                  step={0.1}
                  label="0 means not helpful, 1 means very helpful"
                />
                {error && (
                  <div className="app-panel critical" style={{ marginBottom: "1rem" }}>
                    <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
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
              </div>
            </section>
          )}

          <Button
            onClick={() => {
              setRisk(null);
              setJit(null);
              setError("");
            }}
            variant="secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Assess Again
          </Button>
        </>
      )}

      {feedbackSent && (
        <Toast
          message="Thank you for the feedback. It will improve future interventions."
          type="success"
          onClose={() => setFeedbackSent(false)}
        />
      )}
    </div>
  );
}
