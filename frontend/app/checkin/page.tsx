"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Button, EmptyState, SectionHeader, Slider, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const moods = ["Low", "Uneasy", "Steady", "Good", "Strong"];

type RiskData = {
  score: number;
  bucket: string;
  rationale: string;
};

type CravingHistory = {
  logs: Array<{
    id: string;
    intensity: number;
    mood?: string | null;
    trigger?: string | null;
    location?: string | null;
    action_taken?: string | null;
    ts?: string | null;
  }>;
  patterns: {
    top_trigger: string;
    top_time_window: string;
    top_location: string;
  };
  insight_lines: string[];
};

const interventionActions = [
  "Step away from the current environment for 10 minutes.",
  "Start one grounding round: 5 things you see, 4 you feel, 3 you hear.",
  "Message one safe person before you make the next decision.",
  "Pick one replacement action and commit to it for the next 15 minutes.",
];

export default function CheckInPage() {
  const [token, setToken] = useState("");
  const [craving, setCraving] = useState(4);
  const [urge, setUrge] = useState(4);
  const [mood, setMood] = useState("Steady");
  const [trigger, setTrigger] = useState("");
  const [location, setLocation] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [history, setHistory] = useState<CravingHistory | null>(null);

  const [slipTrigger, setSlipTrigger] = useState("");
  const [slipBefore, setSlipBefore] = useState("");
  const [slipSafeAction, setSlipSafeAction] = useState("");
  const [slipNextHour, setSlipNextHour] = useState("");
  const [slipNextDay, setSlipNextDay] = useState("");
  const [slipNotes, setSlipNotes] = useState("");
  const [slipLoading, setSlipLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    void Promise.all([loadHistory(token), loadRisk(token)]);
  }, [token]);

  const riskState = useMemo(() => {
    if (craving >= 8 || urge >= 8) return "critical";
    if (craving >= 6 || urge >= 6) return "elevated";
    return "steady";
  }, [craving, urge]);

  async function loadHistory(activeToken: string) {
    try {
      const res = await fetch(`${apiBase}/cravings/history`, {
        headers: getAuthHeaders(activeToken),
      });
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRisk(activeToken: string) {
    try {
      const res = await fetch(`${apiBase}/risk`, {
        headers: getAuthHeaders(activeToken),
      });
      const data = await res.json();
      if (res.ok) setRisk(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit() {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cravingRes = await fetch(`${apiBase}/cravings/log`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          intensity: Math.round(craving),
          mood,
          trigger,
          location,
          action_taken: actionTaken,
          notes,
        }),
      });
      if (!cravingRes.ok) throw new Error("Failed to save craving log");

      const checkinRes = await fetch(`${apiBase}/checkins`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          craving: Math.round(craving),
          urge: Math.round(urge),
          mood,
          triggers: trigger ? [trigger] : [],
        }),
      });
      if (!checkinRes.ok) throw new Error("Failed to save check-in");

      await Promise.all([loadHistory(token), loadRisk(token)]);
      setSuccess("Check-in saved. The app has updated your recovery state.");
      setActionTaken("");
      setNotes("");
    } catch (err) {
      console.error(err);
      setError("Failed to save check-in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSlipSubmit() {
    if (!token) return;
    setSlipLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/slip/log`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          trigger: slipTrigger,
          happened_before: slipBefore,
          safe_action: slipSafeAction,
          next_hour_plan: slipNextHour,
          next_day_plan: slipNextDay,
          notes: slipNotes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save slip");
      setSuccess("Slip recorded. Focus is back on the next safe hour, not punishment.");
      setSlipTrigger("");
      setSlipBefore("");
      setSlipSafeAction("");
      setSlipNextHour("");
      setSlipNextDay("");
      setSlipNotes("");
      await loadHistory(token);
    } catch (err) {
      console.error(err);
      setError("Failed to save slip recovery plan. Please try again.");
    } finally {
      setSlipLoading(false);
    }
  }

  if (!token) {
    return (
      <EmptyState
        icon="🔒"
        title="Sign In Required"
        description="Please sign in to use guided check-ins."
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className="recovery-shell">
      <section className="recovery-intro">
        <div>
          <SectionHeader
            title="Recovery Check-In"
            subtitle="Log the moment, see the risk, and act before the window gets harder."
          />
        </div>
        <div className={`recovery-risk-badge ${riskState}`}>
          <span>Current state</span>
          <strong>{riskState === "critical" ? "High risk" : riskState === "elevated" ? "Elevated" : "Steady"}</strong>
        </div>
      </section>

      <section className="recovery-grid-main">
        <div className="recovery-composer">
          <div className="recovery-signal-strip">
            <div>
              <p className="journey-kicker">Signals</p>
              <h2>What is happening right now?</h2>
            </div>
            <p className="recovery-support-copy">Keep it short. The goal is fast awareness, not journaling friction.</p>
          </div>

          <div className="recovery-slider-block">
            <Slider
              value={craving}
              onChange={setCraving}
              min={0}
              max={10}
              step={1}
              label="Craving intensity"
            />
            <Slider
              value={urge}
              onChange={setUrge}
              min={0}
              max={10}
              step={1}
              label="Urge to use"
            />
          </div>

          <div className="recovery-mood-row">
            {moods.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`app-segmented-button${mood === entry ? " active" : ""}`}
                onClick={() => setMood(entry)}
              >
                {entry}
              </button>
            ))}
          </div>

          <div className="recovery-form-grid">
            <label>
              <span className="label">Trigger</span>
              <input
                className="input"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="stress, boredom, loneliness"
              />
            </label>
            <label>
              <span className="label">Location</span>
              <input
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="home, work, outside"
              />
            </label>
            <label>
              <span className="label">What are you doing instead?</span>
              <input
                className="input"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="walk, called a friend, breathing"
              />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">Short note</span>
              <textarea
                className="textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What made this moment harder than usual?"
              />
            </label>
          </div>

          <div className="recovery-action-row">
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Check-In"}
            </Button>
            <a href="/sos" className="landing-secondary-link">
              Open SOS
            </a>
          </div>
        </div>

        <aside className="recovery-sidebar">
          <div className={`recovery-risk-panel ${risk?.bucket?.toLowerCase() || "steady"}`}>
            <p className="journey-kicker">Live risk</p>
            <h3>{risk ? `${risk.bucket} support window` : "Assessing support window"}</h3>
            <p>{risk?.rationale || "Your recent check-ins and tasks are being read for friction signals."}</p>
          </div>

          <div className="recovery-intervention-panel">
            <p className="journey-kicker">Right now</p>
            <h3>Use one action immediately</h3>
            <div className="recovery-intervention-list">
              {interventionActions.map((action) => (
                <div key={action}>{action}</div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="recovery-grid-secondary">
        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Slip Recovery</p>
              <h3>If a slip happened, stabilize the next hour.</h3>
            </div>
            <p>Make the restart concrete. No shame loops.</p>
          </div>
          <div className="recovery-form-grid">
            <label>
              <span className="label">Main trigger</span>
              <input className="input" value={slipTrigger} onChange={(e) => setSlipTrigger(e.target.value)} placeholder="What set it off?" />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">What happened before</span>
              <textarea className="textarea" rows={3} value={slipBefore} onChange={(e) => setSlipBefore(e.target.value)} placeholder="What was happening in the hour before the slip?" />
            </label>
            <label>
              <span className="label">Next safe action</span>
              <input className="input" value={slipSafeAction} onChange={(e) => setSlipSafeAction(e.target.value)} placeholder="leave room, call friend, hydrate" />
            </label>
            <label>
              <span className="label">Plan for the next hour</span>
              <input className="input" value={slipNextHour} onChange={(e) => setSlipNextHour(e.target.value)} placeholder="shower, food, call sponsor" />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">Plan for the next 24 hours</span>
              <textarea className="textarea" rows={3} value={slipNextDay} onChange={(e) => setSlipNextDay(e.target.value)} placeholder="How will you protect tomorrow?" />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">Notes</span>
              <textarea className="textarea" rows={3} value={slipNotes} onChange={(e) => setSlipNotes(e.target.value)} placeholder="Anything you want the next version of you to remember?" />
            </label>
          </div>
          <Button onClick={handleSlipSubmit} disabled={slipLoading}>
            {slipLoading ? "Saving..." : "Save Slip Recovery"}
          </Button>
        </div>

        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Pattern Read</p>
              <h3>What your recent moments are showing</h3>
            </div>
            <p>These patterns sharpen as you log more moments.</p>
          </div>

          <div className="recovery-pattern-grid">
            <div>
              <span>Top trigger</span>
              <strong>{history?.patterns.top_trigger || "Not enough data"}</strong>
            </div>
            <div>
              <span>Most common time</span>
              <strong>{history?.patterns.top_time_window || "Not enough data"}</strong>
            </div>
            <div>
              <span>Most common place</span>
              <strong>{history?.patterns.top_location || "Not enough data"}</strong>
            </div>
          </div>

          <div className="recovery-mini-log">
            {(history?.insight_lines || []).map((line) => (
              <p key={line}>{line}</p>
            ))}
            {(history?.logs || []).slice(0, 4).map((log) => (
              <div key={log.id} className="recovery-log-row">
                <strong>{log.intensity}/10</strong>
                <span>{log.trigger || "No trigger noted"}</span>
                <span>{log.action_taken || "No replacement action logged"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && <Toast message={error} type="error" onClose={() => setError("")} />}
      {success && <Toast message={success} type="success" onClose={() => setSuccess("")} />}
    </div>
  );
}
