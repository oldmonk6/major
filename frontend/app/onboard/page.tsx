"use client";

import React, { useState, useEffect } from "react";
import { Card, Input, Button, SectionHeader, Textarea } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type Step = "addiction" | "triggers" | "goals" | "constraints" | "review";

interface OnboardingData {
  addiction: string;
  triggers: string[];
  goals: string[];
  constraints: string[];
}

export default function OnboardPage() {
  const [step, setStep] = useState<Step>("addiction");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<any>(null);

  const [data, setData] = useState<OnboardingData>({
    addiction: "",
    triggers: [],
    goals: [],
    constraints: [],
  });

  const [tempInput, setTempInput] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const addToArray = (key: keyof Omit<OnboardingData, "addiction">) => {
    if (tempInput.trim()) {
      setData((prev) => ({
        ...prev,
        [key]: [...prev[key], tempInput.trim()],
      }));
      setTempInput("");
    }
  };

  const removeFromArray = (
    key: keyof Omit<OnboardingData, "addiction">,
    index: number
  ) => {
    setData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/onboard`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          addiction: data.addiction,
          triggers: data.triggers,
          goals: data.goals,
          constraints: data.constraints,
          preferences: {},
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to generate plan");
        return;
      }

      setPlan(result.plan || result);
      setStep("review");
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = ["addiction", "triggers", "goals", "constraints"];
  const currentStepIndex = steps.indexOf(step);
  const progress = Math.round(((currentStepIndex + 1) / (steps.length + 1)) * 100);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      {!plan ? (
        <>
          <SectionHeader
            title="Create Your Personalized Recovery Plan"
            subtitle="Let's learn about your journey so we can support you better"
          />

          {/* Progress Bar */}
          <div style={{ marginBottom: "2rem" }}>
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "var(--bg-tertiary)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "var(--primary)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <p
              style={{
                marginTop: "0.5rem",
                textAlign: "right",
                fontSize: "0.9rem",
                color: "var(--text-tertiary)",
              }}
            >
              Step {currentStepIndex + 1} of {steps.length}
            </p>
          </div>

          <Card>
            {/* Addiction Step */}
            {step === "addiction" && (
              <div>
                <h2 style={{ marginBottom: "1rem" }}>What are you recovering from?</h2>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                  Help us understand your specific recovery goals. This helps us create more
                  targeted support and strategies.
                </p>
                <label className="label">Primary Addiction or Habit</label>
                <Input
                  value={data.addiction}
                  onChange={(e) =>
                    setData({ ...data, addiction: e.target.value })
                  }
                  placeholder="e.g., nicotine, alcohol, gambling, social media"
                />
                <p style={{ fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
                  Examples: alcohol, nicotine, gaming, food, shopping, social media
                </p>
              </div>
            )}

            {/* Triggers Step */}
            {step === "triggers" && (
              <div>
                <h2 style={{ marginBottom: "1rem" }}>What are your common triggers?</h2>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                  Understanding what sets off cravings helps us build coping strategies.
                </p>
                <label className="label">Add Your Triggers</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Input
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    placeholder="e.g., stress, social settings, boredom"
                  />
                  <Button
                    onClick={() => addToArray("triggers")}
                    variant="secondary"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Add
                  </Button>
                </div>
                {data.triggers.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {data.triggers.map((trigger, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--bg-tertiary)",
                          padding: "0.5rem 1rem",
                          borderRadius: "1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {trigger}
                        <button
                          onClick={() => removeFromArray("triggers", idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--error)",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Goals Step */}
            {step === "goals" && (
              <div>
                <h2 style={{ marginBottom: "1rem" }}>What are your recovery goals?</h2>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                  Clear goals keep you motivated and focused on meaningful progress.
                </p>
                <label className="label">Add Your Goals</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Input
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    placeholder="e.g., 30-day abstinence, better sleep, improved relationships"
                  />
                  <Button
                    onClick={() => addToArray("goals")}
                    variant="secondary"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Add
                  </Button>
                </div>
                {data.goals.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {data.goals.map((goal, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(var(--success-rgb), 0.2)",
                          color: "var(--success)",
                          padding: "0.5rem 1rem",
                          borderRadius: "1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {goal}
                        <button
                          onClick={() => removeFromArray("goals", idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--error)",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Constraints Step */}
            {step === "constraints" && (
              <div>
                <h2 style={{ marginBottom: "1rem" }}>Any constraints or preferences?</h2>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
                  Help us tailor strategies to fit your lifestyle and limitations.
                </p>
                <label className="label">Add Constraints (Optional)</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Input
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    placeholder="e.g., limited time, prefer morning activities, health conditions"
                  />
                  <Button
                    onClick={() => addToArray("constraints")}
                    variant="secondary"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Add
                  </Button>
                </div>
                {data.constraints.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {data.constraints.map((constraint, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--bg-tertiary)",
                          padding: "0.5rem 1rem",
                          borderRadius: "1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {constraint}
                        <button
                          onClick={() => removeFromArray("constraints", idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--error)",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  background: "rgba(var(--error-rgb), 0.2)",
                  border: "1px solid var(--error)",
                  borderRadius: "0.5rem",
                  color: "var(--error)",
                }}
              >
                {error}
              </div>
            )}

            {/* Navigation Buttons */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: "2rem",
                justifyContent: "space-between",
              }}
            >
              <Button
                onClick={() => {
                  const idx = steps.indexOf(step);
                  if (idx > 0) setStep(steps[idx - 1]);
                }}
                variant="secondary"
                disabled={step === "addiction"}
              >
                ← Back
              </Button>

              {step === "constraints" ? (
                <Button
                  onClick={handleSubmit}
                  disabled={
                    loading || !data.addiction || data.triggers.length === 0 || data.goals.length === 0
                  }
                  style={{ minWidth: "200px", justifyContent: "center" }}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
                      Generating...
                    </span>
                  ) : (
                    "Generate My Plan"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const idx = steps.indexOf(step);
                    if (idx < steps.length - 1) setStep(steps[idx + 1]);
                  }}
                  disabled={
                    (step === "addiction" && !data.addiction) ||
                    (step === "triggers" && data.triggers.length === 0) ||
                    (step === "goals" && data.goals.length === 0)
                  }
                  style={{ minWidth: "200px" }}
                >
                  Next →
                </Button>
              )}
            </div>
          </Card>
        </>
      ) : (
        // Plan Review
        <>
          <SectionHeader
            title="🎉 Your Recovery Plan is Ready!"
            subtitle="Your personalized recovery journey has been created. Start taking action today."
          />

          <Card style={{ borderLeft: "4px solid var(--success)" }}>
            <h2 style={{ marginBottom: "1rem", color: "var(--success)" }}>Plan Summary</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Your personalized recovery plan has been generated based on your responses. Check the
              Tasks page to see your daily activities and get started!
            </p>

            <details
              style={{
                marginTop: "1.5rem",
                cursor: "pointer",
              }}
            >
              <summary
                style={{
                  padding: "1rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                View Full Plan Details
              </summary>
              <pre
                style={{
                  marginTop: "1rem",
                  background: "var(--bg-primary)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  overflow: "auto",
                  fontSize: "0.85rem",
                }}
              >
                {JSON.stringify(plan, null, 2)}
              </pre>
            </details>

            <Button
              onClick={() => (window.location.href = "/tasks")}
              style={{ width: "100%", marginTop: "2rem", justifyContent: "center" }}
            >
              Start Your First Task
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
