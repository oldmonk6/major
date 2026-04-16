"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

import { Button } from "@/components/ui";

const LandingScene = dynamic(() => import("@/components/landing-scene"), { ssr: false });

const heroFade = {
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: "easeOut" as const },
};

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const ritualSteps = [
  {
    label: "01",
    title: "Read the day clearly",
    copy: "Check-ins, cravings, and friction points become one calm picture instead of noise.",
  },
  {
    label: "02",
    title: "Take the next useful step",
    copy: "Five meaningful tasks keep the day small enough to handle and structured enough to trust.",
  },
  {
    label: "03",
    title: "Recover with people, not alone",
    copy: "Circles, shared wins, and guided support make progress visible and harder to abandon.",
  },
];

const proofPoints = [
  "Adaptive daily plans that react to actual momentum",
  "A visible task ascent that makes completion feel immediate",
  "Risk-aware support before a hard window becomes a collapse",
];

const circleMoments = [
  { name: "Asha", note: "Closed her late-night trigger loop before it escalated.", streak: "8 day rhythm" },
  { name: "Nikhil", note: "Finished a difficult task block and shared the win with his circle.", streak: "4 day rebuild" },
  { name: "Mira", note: "Reached full completion and unlocked tomorrow's calmer start.", streak: "12 day run" },
];

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("reclaim_token");
    setIsAuthenticated(Boolean(token));
  }, []);

  const primaryAction = isAuthenticated
    ? { label: "Return To Your Plan", href: "/tasks" }
    : { label: "Start Your Plan", href: "/auth" };

  return (
    <div className="landing-page-shell">
      <LandingScene />

      <section className="landing-hero">
        <div className="landing-hero-scrim" />
        <div className="landing-hero-grid">
          <motion.div className="landing-hero-copy" {...heroFade}>
            <p className="landing-brand">RECLAIM</p>
            <h1>
              Recovery should feel
              <span> clear, alive, and easy to re-enter.</span>
            </h1>
            <p className="landing-hero-body">
              RECLAIM turns a difficult day into a structured climb: adaptive tasks, early support,
              and a calm sense of visible movement that makes the next step obvious.
            </p>
            <div className="landing-hero-actions">
              <Button onClick={() => (window.location.href = primaryAction.href)}>
                {primaryAction.label}
              </Button>
              <a href="#ritual" className="landing-secondary-link">
                See The Flow
              </a>
            </div>
          </motion.div>

          <motion.div
            className="landing-hero-panel"
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: "easeOut" }}
          >
            <div className="landing-hero-panel-head">
              <p>Tonight&apos;s task motion</p>
              <span>Visible, direct, calm</span>
            </div>

            <div className="landing-path-stage">
              <div className="landing-path-line" />
              <div className="landing-path-fill" />
              {[18, 42, 68, 92].map((left, index) => (
                <div
                  key={left}
                  className={`landing-path-node${index < 3 ? " active" : ""}`}
                  style={{ left: `${left}%` }}
                />
              ))}
              <motion.div
                className="landing-path-traveler"
                animate={{ x: [0, 12, 24, 36, 48], y: [0, -4, 0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="landing-traveler-glow" />
                <div className="landing-traveler-stick">
                  <span className="head" />
                  <span className="body" />
                  <motion.span
                    className="arm left"
                    animate={{ rotate: [30, -26, 30] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="arm right"
                    animate={{ rotate: [-30, 26, -30] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="leg left"
                    animate={{ rotate: [-22, 24, -22] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="leg right"
                    animate={{ rotate: [22, -24, 22] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            </div>

            <div className="landing-hero-metrics">
              <div>
                <strong>5</strong>
                <span>guided daily steps</span>
              </div>
              <div>
                <strong>1 route</strong>
                <span>visible forward motion</span>
              </div>
              <div>
                <strong>Daily</strong>
                <span>small chances to reset</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="landing-story">
        <motion.section id="ritual" className="landing-section" {...reveal}>
          <div className="landing-section-intro">
            <p className="landing-kicker">The Daily Ritual</p>
            <h2>Make the app feel worth returning to every day.</h2>
            <p>
              People return when the experience rewards continuity. RECLAIM should feel less like a
              dashboard and more like a precise daily rhythm that notices effort, reflects it back,
              and keeps the next step obvious.
            </p>
          </div>

          <div className="landing-ritual-grid">
            {ritualSteps.map((step) => (
              <article key={step.label} className="landing-ritual-item">
                <span>{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section className="landing-section landing-proof-band" {...reveal}>
          <div className="landing-proof-copy">
            <p className="landing-kicker">Why It Pulls People Back</p>
            <h2>Visible progress, emotional safety, and social gravity.</h2>
          </div>
          <div className="landing-proof-list">
            {proofPoints.map((point) => (
              <div key={point} className="landing-proof-item">
                <span />
                <p>{point}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className="landing-section landing-feature-grid" {...reveal}>
          <div className="landing-feature-copy">
            <p className="landing-kicker">Adaptive System</p>
            <h2>Your data becomes timing, tone, and a cleaner forward path.</h2>
            <p>
              Check-ins, risk, task completion, and community energy should shape what the product does
              next. The best version of RECLAIM feels personal without feeling clinical.
            </p>
          </div>

          <div className="landing-feature-stack">
            <article>
              <strong>Responsive coaching</strong>
              <p>Shorter, calmer interventions when the day is fragile. More ambition when momentum is strong.</p>
            </article>
            <article>
              <strong>Premium journey feedback</strong>
              <p>Animated forward motion, milestone markers, and subtle celebration make effort tangible instead of abstract.</p>
            </article>
            <article>
              <strong>Recovery memory</strong>
              <p>The app remembers patterns, hard hours, and what helped last time, so the flow improves over time.</p>
            </article>
          </div>
        </motion.section>

        <motion.section className="landing-section landing-community-grid" {...reveal}>
          <div className="landing-community-copy">
            <p className="landing-kicker">Community Layer</p>
            <h2>Give people a reason to return for each other, not only for themselves.</h2>
            <p>
              Shared circles, accountability partners, and visible wins create a social loop with warmth.
              It raises retention because the product stops feeling solitary.
            </p>
          </div>

          <div className="landing-community-panel">
            {circleMoments.map((moment) => (
              <article key={moment.name} className="landing-community-moment">
                <div className="landing-community-avatar">{moment.name.slice(0, 1)}</div>
                <div>
                  <div className="landing-community-head">
                    <strong>{moment.name}</strong>
                    <span>{moment.streak}</span>
                  </div>
                  <p>{moment.note}</p>
                </div>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section className="landing-final-cta" {...reveal}>
          <p className="landing-kicker">Start The Next Session</p>
          <h2>Build a recovery experience people want to revisit, trust, and keep moving through.</h2>
          <p>
            Structure keeps the day moving. Community keeps the user returning. Better flow makes the
            whole product feel premium.
          </p>
          <div className="landing-hero-actions landing-final-actions">
            <Button onClick={() => (window.location.href = primaryAction.href)}>
              {primaryAction.label}
            </Button>
            {!isAuthenticated && (
              <a href="/coach" className="landing-secondary-link">
                Preview The Coach
              </a>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
