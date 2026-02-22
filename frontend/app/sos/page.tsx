"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader, Card, Button, Textarea, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const resources = [
  {
    name: "988 Suicide & Crisis Lifeline",
    number: "988",
    description: "Call or text for immediate support (US)",
    available: "24/7",
  },
  {
    name: "Crisis Text Line",
    number: "Text HOME to 741741",
    description: "Text-based crisis support",
    available: "24/7",
  },
  {
    name: "SAMHSA National Helpline",
    number: "1-800-662-4357",
    description: "Treatment referrals and information",
    available: "24/7",
  },
];

export default function SOSPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  const sendAlert = async () => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/sos/alert`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          type: "sos",
          message: message.trim() || "I need support right now",
        }),
      });

      if (!res.ok) throw new Error("Failed to send alert");

      const data = await res.json();
      setSuccess(
        "Alert sent! Your support network has been notified. You're not alone."
      );

      // Reset form
      setTimeout(() => {
        setMessage("");
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError("Failed to send alert. Please try again or call for immediate help.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Emergency Header */}
      <Card
        style={{
          borderLeft: "4px solid var(--error)",
          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, transparent 100%)",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ color: "var(--error)", marginBottom: "0.5rem" }}>
          Crisis Support is Available
        </h1>
        <p style={{ fontSize: "1.1rem", lineHeight: "1.6", color: "var(--text-secondary)", margin: 0 }}>
          You are not alone. If you're in crisis, help is available right now, 24/7.
        </p>
      </Card>

      {/* Primary Emergency Resource */}
      <Card
        style={{
          borderLeft: "4px solid var(--error)",
          background: "var(--bg-secondary)",
          marginBottom: "2rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-tertiary)",
            margin: "0 0 1rem 0",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Immediate Assistance
        </p>
        <h2
          style={{
            fontSize: "4rem",
            fontWeight: 800,
            color: "var(--error)",
            margin: "0 0 1rem 0",
          }}
        >
          988
        </h2>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--text-primary)" }}>
          Suicide & Crisis Lifeline
        </h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Call or text 988 anytime, day or night. Trained counselors are standing by.
        </p>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.95rem", margin: 0 }}>
          Free • Confidential • 24/7
        </p>
      </Card>

      {/* Alert Network */}
      <Card style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Alert Your Support Network</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          Send an alert to your trusted contacts to let them know you need support right now.
        </p>

        <label className="label">Your Message (Optional)</label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="I'm struggling right now and need someone to talk to. Please reach out to me."
          rows={4}
        />

        {error && (
          <div
            style={{
              marginTop: "1rem",
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
          onClick={sendAlert}
          disabled={loading}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, var(--error) 0%, #dc2626 100%)",
            justifyContent: "center",
            marginTop: "1rem",
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="loading-spinner" style={{ width: "1rem", height: "1rem" }} />
              Sending Alert...
            </span>
          ) : (
            "Send Crisis Alert"
          )}
        </Button>
      </Card>

      {/* Other Resources */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Other Resources</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          {resources.map((resource, idx) => (
            <Card key={idx} style={{ borderLeft: "4px solid var(--primary-light)" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>{resource.name}</h3>
              <p
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--primary-light)",
                  margin: "0.5rem 0",
                }}
              >
                {resource.number}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: "0.5rem 0" }}>
                {resource.description}
              </p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", margin: 0 }}>
                {resource.available}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Self-Care Tips */}
      <Card style={{ background: "var(--bg-secondary)" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>In This Moment</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <h4 style={{ marginBottom: "0.5rem", color: "var(--primary-light)" }}>Ground Yourself</h4>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
              Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.
            </p>
          </div>
          <div>
            <h4 style={{ marginBottom: "0.5rem", color: "var(--primary-light)" }}>Breathe Deeply</h4>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
              Breathe in for 4 counts, hold for 4, exhale for 4. Repeat 5 times.
            </p>
          </div>
          <div>
            <h4 style={{ marginBottom: "0.5rem", color: "var(--primary-light)" }}>Move Your Body</h4>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
              Take a walk, stretch, or do any movement that helps you feel present.
            </p>
          </div>
          <div>
            <h4 style={{ marginBottom: "0.5rem", color: "var(--primary-light)" }}>Reach Out</h4>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
              Call a friend, family member, or crisis line. Connection helps.
            </p>
          </div>
        </div>
      </Card>

      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
