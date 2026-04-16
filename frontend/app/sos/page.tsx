"use client";

import React, { useEffect, useState } from "react";

import { Button, EmptyState, SectionHeader, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type EmergencyPlan = {
  triggers: string[];
  danger_hours: string[];
  safe_places: string[];
  replacement_actions: string[];
  reasons_to_quit: string[];
};

type SupportCircle = {
  members: Array<{
    id: string;
    name: string;
    relationship_label?: string | null;
    contact?: string | null;
  }>;
};

export default function SOSPage() {
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<EmergencyPlan | null>(null);
  const [support, setSupport] = useState<SupportCircle>({ members: [] });
  const [message, setMessage] = useState("I am struggling right now and need someone to reach out.");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadData(token);
  }, [token]);

  const displayDangerHours = plan?.danger_hours?.length ? plan.danger_hours : ["Late night", "After conflict", "During isolation"];
  const displaySafePlaces = plan?.safe_places?.length ? plan.safe_places : ["Step outside", "Go to a public place", "Move toward another person"];
  const displayTriggers = plan?.triggers?.length ? plan.triggers : ["Stress spike", "Loneliness", "Unstructured downtime"];
  const displayReasons = plan?.reasons_to_quit?.length ? plan.reasons_to_quit : ["Protect tomorrow", "Stay honest with yourself", "Keep momentum alive"];
  const displayActions = plan?.replacement_actions?.length
    ? plan.replacement_actions
    : ["Drink water and walk for 10 minutes.", "Call or text one trusted person.", "Move to a safer environment immediately."];

  async function loadData(activeToken: string) {
    try {
      const [planRes, supportRes] = await Promise.all([
        fetch(`${apiBase}/emergency-plan`, { headers: getAuthHeaders(activeToken) }),
        fetch(`${apiBase}/support-circle`, { headers: getAuthHeaders(activeToken) }),
      ]);
      const planData = await planRes.json();
      const supportData = await supportRes.json();
      if (planRes.ok) setPlan(planData.plan);
      if (supportRes.ok) setSupport(supportData);
    } catch (err) {
      console.error(err);
    }
  }

  async function sendAlert() {
    if (!token) return;
    setLoading(true);
    try {
      const [supportAlertRes, sosRes] = await Promise.all([
        fetch(`${apiBase}/support-circle/alert`, {
          method: "POST",
          headers: getAuthHeaders(token),
          body: JSON.stringify({ message }),
        }),
        fetch(`${apiBase}/sos/alert`, {
          method: "POST",
          headers: getAuthHeaders(token),
          body: JSON.stringify({ type: "sos", message }),
        }),
      ]);

      if (!supportAlertRes.ok || !sosRes.ok) throw new Error("Failed to send alert");
      setToast({ message: "Rescue alert recorded. Use the steps below right now.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to send rescue alert.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <EmptyState
        icon="🆘"
        title="Sign In Required"
        description="Please sign in to access SOS support."
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className="recovery-shell">
      <section className="recovery-intro">
        <div>
          <SectionHeader
            title="SOS Rescue Flow"
            subtitle="Reduce choices. Stabilize the next ten minutes. Pull in support quickly."
          />
        </div>
        <div className="recovery-risk-badge critical">
          <span>Emergency mode</span>
          <strong>Active</strong>
        </div>
      </section>

      <section className="recovery-grid-main">
        <div className="recovery-section-block rescue-surface">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Immediate actions</p>
              <h3>Do these now, in order.</h3>
            </div>
            <p>No long reading. Just move.</p>
          </div>

          <div className="rescue-step-list">
            <div>
              <strong>1</strong>
              <span>Leave the current environment or put distance between you and the trigger.</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Drink water and take ten slow breaths.</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Message one safe person before you make another decision.</span>
            </div>
            <div>
              <strong>4</strong>
              <span>Use one replacement action from your plan below.</span>
            </div>
          </div>

          <label className="label" style={{ marginTop: "1.2rem" }}>
            Alert message
          </label>
          <textarea
            className="textarea"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="recovery-action-row">
            <Button onClick={sendAlert} disabled={loading}>
              {loading ? "Sending..." : "Send Rescue Alert"}
            </Button>
            <a href="tel:988" className="landing-secondary-link">
              Call 988
            </a>
          </div>
        </div>

        <aside className="recovery-sidebar">
          <div className="recovery-risk-panel critical">
            <p className="journey-kicker">Support circle</p>
            <h3>{support.members.length} active contact{support.members.length === 1 ? "" : "s"}</h3>
            <p>The alert will reference the support circle stored in your recovery dashboard.</p>
          </div>

          <div className="recovery-intervention-panel">
            <p className="journey-kicker">24/7 lines</p>
            <div className="recovery-intervention-list">
              <div>988 Suicide & Crisis Lifeline</div>
              <div>Text HOME to 741741</div>
              <div>SAMHSA: 1-800-662-4357</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="recovery-grid-secondary">
        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Your Emergency Plan</p>
              <h3>Use what you already prepared.</h3>
            </div>
            <p>Keep it visible in the hard window. If the plan is still empty, use the defaults below and fill it in later.</p>
          </div>
          <div className="recovery-pattern-grid">
            <div>
              <span>Danger hours</span>
              <strong>{displayDangerHours.join(", ")}</strong>
            </div>
            <div>
              <span>Safe places</span>
              <strong>{displaySafePlaces.join(", ")}</strong>
            </div>
            <div>
              <span>Top triggers</span>
              <strong>{displayTriggers.join(", ")}</strong>
            </div>
            <div>
              <span>Reasons to quit</span>
              <strong>{displayReasons.join(", ")}</strong>
            </div>
          </div>
          <div className="recovery-mini-log rescue-fallback-list">
            {displayActions.slice(0, 4).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          {(!plan?.replacement_actions || plan.replacement_actions.length === 0) && (
            <div className="recovery-action-row">
              <a href="/progress" className="landing-secondary-link">
                Finish Your Recovery Plan
              </a>
            </div>
          )}
        </div>

        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">People to Contact</p>
              <h3>Use one human connection before the spiral gets louder.</h3>
            </div>
            <p>Small circle. Fast reach-out.</p>
          </div>
          <div className="recovery-support-list">
            {support.members.length === 0 ? (
              <div className="rescue-empty-contacts">
                <p>No support contacts are saved yet.</p>
                <p>Add one trusted person in Recovery so SOS can alert someone fast.</p>
                <a href="/progress" className="landing-secondary-link">
                  Add People In Recovery
                </a>
              </div>
            ) : (
              support.members.map((member) => (
                <div key={member.id} className="recovery-log-row">
                  <strong>{member.name}</strong>
                  <span>{member.relationship_label || "Support contact"}</span>
                  <span>{member.contact || "No contact saved"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
