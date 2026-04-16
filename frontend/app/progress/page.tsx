"use client";

import React, { useEffect, useState } from "react";

import { Button, EmptyState, SectionHeader, Toast } from "@/components/ui";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type ProgressSummary = {
  total_xp: number;
  completed_tasks: number;
  total_tasks: number;
  streak_days: number;
  cravings_logged: number;
  cravings_resisted: number;
  slips_logged: number;
  avg_craving_intensity: number;
  patterns: {
    top_trigger: string;
    top_time_window: string;
    top_location: string;
  };
  insight_lines: string[];
};

type EmergencyPlan = {
  triggers: string[];
  danger_hours: string[];
  contacts: Array<{ name: string; contact: string; relationship: string }>;
  safe_places: string[];
  replacement_actions: string[];
  reasons_to_quit: string[];
};

type SupportCircleResponse = {
  members: Array<{
    id: string;
    name: string;
    relationship_label?: string | null;
    contact?: string | null;
    status: string;
  }>;
};

export default function ProgressPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [support, setSupport] = useState<SupportCircleResponse>({ members: [] });
  const [loading, setLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [plan, setPlan] = useState<EmergencyPlan>({
    triggers: [],
    danger_hours: [],
    contacts: [],
    safe_places: [],
    replacement_actions: [],
    reasons_to_quit: [],
  });
  const [planDraft, setPlanDraft] = useState({
    triggers: "",
    danger_hours: "",
    safe_places: "",
    replacement_actions: "",
    reasons_to_quit: "",
  });

  const [memberName, setMemberName] = useState("");
  const [memberRelationship, setMemberRelationship] = useState("");
  const [memberContact, setMemberContact] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("reclaim_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadEverything(token);
  }, [token]);

  async function loadEverything(activeToken: string) {
    setLoading(true);
    try {
      const [summaryRes, planRes, supportRes] = await Promise.all([
        fetch(`${apiBase}/progress/summary`, { headers: getAuthHeaders(activeToken) }),
        fetch(`${apiBase}/emergency-plan`, { headers: getAuthHeaders(activeToken) }),
        fetch(`${apiBase}/support-circle`, { headers: getAuthHeaders(activeToken) }),
      ]);

      const summaryData = await summaryRes.json();
      const planData = await planRes.json();
      const supportData = await supportRes.json();

      if (summaryRes.ok) setSummary(summaryData);
      if (planRes.ok) {
        setPlan(planData.plan);
        setPlanDraft({
          triggers: (planData.plan?.triggers || []).join(", "),
          danger_hours: (planData.plan?.danger_hours || []).join(", "),
          safe_places: (planData.plan?.safe_places || []).join(", "),
          replacement_actions: (planData.plan?.replacement_actions || []).join(", "),
          reasons_to_quit: (planData.plan?.reasons_to_quit || []).join(", "),
        });
      }
      if (supportRes.ok) setSupport(supportData);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load recovery data.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function savePlan() {
    if (!token) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`${apiBase}/emergency-plan`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify(planDraft),
      });
      if (!res.ok) throw new Error("Failed to save plan");
      await loadEverything(token);
      setToast({ message: "Emergency plan updated.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to save emergency plan.", type: "error" });
    } finally {
      setSavingPlan(false);
    }
  }

  async function addMember() {
    if (!token || !memberName.trim()) return;
    setSavingMember(true);
    try {
      const res = await fetch(`${apiBase}/support-circle/invite`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          name: memberName,
          relationship_label: memberRelationship,
          contact: memberContact,
        }),
      });
      if (!res.ok) throw new Error("Failed to add support member");
      setMemberName("");
      setMemberRelationship("");
      setMemberContact("");
      await loadEverything(token);
      setToast({ message: "Support circle updated.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to add support member.", type: "error" });
    } finally {
      setSavingMember(false);
    }
  }

  if (!token) {
    return (
      <EmptyState
        icon="📈"
        title="Sign In Required"
        description="Please sign in to view your recovery dashboard."
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className="recovery-shell">
      <section className="recovery-intro">
        <div>
          <SectionHeader
            title="Recovery Dashboard"
            subtitle="See the pattern, protect the next risk window, and keep your support system close."
          />
        </div>
        <div className="recovery-risk-badge steady">
          <span>Recovery system</span>
          <strong>{loading ? "Updating" : "Live"}</strong>
        </div>
      </section>

      <section className="recovery-stat-ribbon">
        <div>
          <span>Total XP</span>
          <strong>{summary?.total_xp ?? 0}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>{summary?.streak_days ?? 0} days</strong>
        </div>
        <div>
          <span>Cravings logged</span>
          <strong>{summary?.cravings_logged ?? 0}</strong>
        </div>
        <div>
          <span>Cravings resisted</span>
          <strong>{summary?.cravings_resisted ?? 0}</strong>
        </div>
        <div>
          <span>Slip logs</span>
          <strong>{summary?.slips_logged ?? 0}</strong>
        </div>
      </section>

      <section className="recovery-grid-main">
        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Pattern Intelligence</p>
              <h3>What your recent data is repeating</h3>
            </div>
            <p>Use this to adjust the next few days, not to judge yourself.</p>
          </div>

          <div className="recovery-pattern-grid">
            <div>
              <span>Top trigger</span>
              <strong>{summary?.patterns.top_trigger || "Not enough data"}</strong>
            </div>
            <div>
              <span>Hardest time window</span>
              <strong>{summary?.patterns.top_time_window || "Not enough data"}</strong>
            </div>
            <div>
              <span>Repeated location</span>
              <strong>{summary?.patterns.top_location || "Not enough data"}</strong>
            </div>
            <div>
              <span>Average craving intensity</span>
              <strong>{summary?.avg_craving_intensity ?? 0}/10</strong>
            </div>
          </div>

          <div className="recovery-mini-log">
            {(summary?.insight_lines || []).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <aside className="recovery-sidebar">
          <div className="recovery-risk-panel steady">
            <p className="journey-kicker">Readiness</p>
            <h3>
              {summary
                ? `${summary.completed_tasks}/${summary.total_tasks} tasks completed`
                : "Loading progress"}
            </h3>
            <p>
              Keep the daily plan small. The emergency plan and support circle should carry the weight when the day turns.
            </p>
          </div>
        </aside>
      </section>

      <section className="recovery-grid-secondary">
        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Emergency Plan</p>
              <h3>Pre-build the rescue flow before you need it.</h3>
            </div>
            <p>Keep this practical and short.</p>
          </div>

          <div className="recovery-form-grid">
            <label>
              <span className="label">Top triggers</span>
              <textarea className="textarea" rows={3} value={planDraft.triggers} onChange={(e) => setPlanDraft((prev) => ({ ...prev, triggers: e.target.value }))} placeholder="stress, loneliness, conflict" />
            </label>
            <label>
              <span className="label">Danger hours</span>
              <textarea className="textarea" rows={3} value={planDraft.danger_hours} onChange={(e) => setPlanDraft((prev) => ({ ...prev, danger_hours: e.target.value }))} placeholder="10 PM - 1 AM, after work" />
            </label>
            <label>
              <span className="label">Safe places</span>
              <textarea className="textarea" rows={3} value={planDraft.safe_places} onChange={(e) => setPlanDraft((prev) => ({ ...prev, safe_places: e.target.value }))} placeholder="friend's house, gym, outside" />
            </label>
            <label>
              <span className="label">Replacement actions</span>
              <textarea className="textarea" rows={3} value={planDraft.replacement_actions} onChange={(e) => setPlanDraft((prev) => ({ ...prev, replacement_actions: e.target.value }))} placeholder="walk, shower, call someone" />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">Reasons to quit</span>
              <textarea className="textarea" rows={4} value={planDraft.reasons_to_quit} onChange={(e) => setPlanDraft((prev) => ({ ...prev, reasons_to_quit: e.target.value }))} placeholder="health, family, stability, self-respect" />
            </label>
          </div>

          <Button onClick={savePlan} disabled={savingPlan}>
            {savingPlan ? "Saving..." : "Save Emergency Plan"}
          </Button>
        </div>

        <div className="recovery-section-block">
          <div className="recovery-section-head">
            <div>
              <p className="journey-kicker">Support Circle</p>
              <h3>Keep one or two people close to the flow.</h3>
            </div>
            <p>This should stay small and real.</p>
          </div>

          <div className="recovery-form-grid">
            <label>
              <span className="label">Name</span>
              <input className="input" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Asha" />
            </label>
            <label>
              <span className="label">Relationship</span>
              <input className="input" value={memberRelationship} onChange={(e) => setMemberRelationship(e.target.value)} placeholder="friend, sibling, sponsor" />
            </label>
            <label className="recovery-form-span-2">
              <span className="label">Contact</span>
              <input className="input" value={memberContact} onChange={(e) => setMemberContact(e.target.value)} placeholder="phone or email" />
            </label>
          </div>

          <div className="recovery-support-list">
            {support.members.length === 0 ? (
              <p>No support members added yet.</p>
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

          <Button onClick={addMember} disabled={savingMember || !memberName.trim()}>
            {savingMember ? "Adding..." : "Add Support Contact"}
          </Button>
        </div>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
