"use client";

import React, { useEffect, useState } from "react";
import { Card, SectionHeader, Button, Grid } from "@/components/ui";

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    setIsAuthenticated(!!token);
  }, []);

  const features = [
    {
      title: "Personalized Plans",
      description: "AI-generated recovery plans tailored to your unique journey and goals.",
      icon: "📋",
    },
    {
      title: "Daily Tasks",
      description: "Structured daily activities designed to build momentum and resilience.",
      icon: "✓",
    },
    {
      title: "Emotional Check-ins",
      description: "Track your feelings and triggers with simple daily reflections.",
      icon: "💭",
    },
    {
      title: "AI Coaching",
      description: "Get personalized guidance and support whenever you need it.",
      icon: "🤖",
    },
    {
      title: "Progress Tracking",
      description: "Celebrate milestones and visualize your recovery journey.",
      icon: "📈",
    },
    {
      title: "Crisis Support",
      description: "SOS features and crisis resources available 24/7.",
      icon: "🆘",
    },
  ];

  const resources = [
    { name: "SAMHSA National Helpline", number: "1-800-662-4357", available: "24/7" },
    { name: "Crisis Text Line", text: "Text HOME to 741741", available: "24/7" },
    { name: "988 Suicide & Crisis Lifeline", number: "988", available: "24/7" },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section style={{ marginBottom: "4rem", textAlign: "center", paddingTop: "2rem" }}>
        <h1 style={{ fontSize: "3.5rem", marginBottom: "1rem", fontWeight: 800 }}>
          Your Recovery Journey Starts Here
        </h1>
        <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
          RECLAIM is your personalized companion for addiction recovery. With AI coaching,
          daily support, and evidence-based strategies, you're never alone.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {isAuthenticated ? (
            <Button onClick={() => (window.location.href = "/tasks")}>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button onClick={() => (window.location.href = "/auth")}>
                Get Started
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/sos")}>
                Find Help Now
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ marginBottom: "4rem" }}>
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>How RECLAIM Supports You</h2>
        <Grid cols={3} gap="1.5rem">
          {features.map((feature, idx) => (
            <Card key={idx}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{feature.icon}</div>
              <h3 style={{ marginBottom: "0.5rem" }}>{feature.title}</h3>
              <p>{feature.description}</p>
            </Card>
          ))}
        </Grid>
      </section>

      {/* Trust & Safety Section */}
      <section style={{ marginBottom: "4rem" }}>
        <Card style={{ background: "linear-gradient(135deg, var(--surface) 0%, rgba(6, 182, 212, 0.05) 100%)" }}>
          <h2 style={{ marginBottom: "1rem" }}>Your Safety & Privacy Matter</h2>
          <Grid cols={2} gap="2rem">
            <div>
              <h4 style={{ color: "var(--primary-light)", marginBottom: "0.5rem" }}>🔒 Secure & Private</h4>
              <p>Your recovery story is yours alone. All data is encrypted and never shared without your consent.</p>
            </div>
            <div>
              <h4 style={{ color: "var(--primary-light)", marginBottom: "0.5rem" }}>🩺 Evidence-Based</h4>
              <p>Strategies grounded in cognitive behavioral therapy, motivational interviewing, and peer support principles.</p>
            </div>
            <div>
              <h4 style={{ color: "var(--primary-light)", marginBottom: "0.5rem" }}>👥 Community Support</h4>
              <p>Connect with others on similar journeys. You are not alone in this recovery.</p>
            </div>
            <div>
              <h4 style={{ color: "var(--primary-light)", marginBottom: "0.5rem" }}>📞 Crisis Resources</h4>
              <p>Immediate access to professional crisis support and emergency resources when you need them most.</p>
            </div>
          </Grid>
        </Card>
      </section>

      {/* Crisis Resources */}
      <section style={{ marginBottom: "4rem" }}>
        <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Always Available Resources</h2>
        <Grid cols={3} gap="1.5rem">
          {resources.map((resource, idx) => (
            <Card key={idx} style={{ borderLeft: "4px solid var(--primary-light)" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>{resource.name}</h3>
              <p style={{ marginBottom: "0.5rem", fontSize: "1.1rem", fontWeight: 600, color: "var(--primary-light)" }}>
                {resource.number || resource.text}
              </p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>{resource.available}</p>
            </Card>
          ))}
        </Grid>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section style={{ textAlign: "center" }}>
          <Card style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)" }}>
            <h2 style={{ color: "white", marginBottom: "1rem" }}>Ready to Reclaim Your Life?</h2>
            <p style={{ color: "rgba(255, 255, 255, 0.9)", marginBottom: "1.5rem" }}>
              Join thousands who are taking control of their recovery with personalized support and evidence-based tools.
            </p>
            <Button 
              onClick={() => (window.location.href = "/auth")}
              style={{ background: "white", color: "var(--primary)", fontWeight: 700 }}
            >
              Create Your Account Today
            </Button>
          </Card>
        </section>
      )}
    </div>
  );
}
