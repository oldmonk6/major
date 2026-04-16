"use client";

import React, { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui";
import { WorldExplorerScene } from "@/components/world-explorer-scene";
import { getPersonaForUser } from "@/lib/avatar-journey";
import { getAuthHeaders } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type Task = {
  id: string;
  title: string;
  status: "pending" | "completed";
  xp: number;
  day_in_week?: number;
};

type ProgressSummary = {
  total_xp: number;
  completed_tasks: number;
  total_tasks: number;
  streak_days: number;
};

const worldZones = [
  {
    id: "coach",
    href: "/coach",
    title: "Guide Cabin",
    label: "Forest retreat",
    note: "The coach companion waits in a timber cabin lit by warm hanging lamps.",
    color: "#f8b96d",
    position: [-3.6, 0.42, 1.1] as [number, number, number],
    kind: "cabin" as const,
  },
  {
    id: "checkin",
    href: "/checkin",
    title: "Reflection Pool",
    label: "Coastal stillness",
    note: "A tide basin for reading the emotional weather before the day starts drifting.",
    color: "#7fd7f4",
    position: [-1.2, 0.3, -1.9] as [number, number, number],
    kind: "pool" as const,
  },
  {
    id: "progress",
    href: "/progress",
    title: "Signal Tower",
    label: "Lantern skyline",
    note: "A beacon overlooking the sanctuary, showing streaks, motion, and what unlocks next.",
    color: "#ffd879",
    position: [2.6, 0.44, -1.5] as [number, number, number],
    kind: "tower" as const,
  },
  {
    id: "journal",
    href: "/journal",
    title: "Archive Room",
    label: "Observatory archive",
    note: "A memory chamber where entries, patterns, and constellations are stored together.",
    color: "#c6b7ff",
    position: [4.1, 0.38, 1.4] as [number, number, number],
    kind: "archive" as const,
  },
];

function getWorldState(summary: ProgressSummary | null) {
  if (!summary || summary.total_tasks === 0) {
    return {
      title: "Blue Dawn Harbor",
      note: "The sanctuary is present but lightly lit. Walk the path to wake the village.",
      skyClass: "dawn" as const,
      phaseLabel: "Dawn tide",
      environmentalShift: "Only the core path glows. Most structures are still quiet.",
      progress: 0.18,
    };
  }

  const ratio = summary.completed_tasks / Math.max(summary.total_tasks, 1);
  if (ratio >= 0.8) {
    return {
      title: "Golden Lantern Rise",
      note: "The coast is fully alive. Every destination is bright and the route between them feels inhabited.",
      skyClass: "golden" as const,
      phaseLabel: "Golden hour",
      environmentalShift: "Lantern density is high, the path is fully illuminated, and the horizon is warm.",
      progress: 0.94,
    };
  }
  if (ratio >= 0.4) {
    return {
      title: "Amber Coast",
      note: "The world is warming. The route opens up and the sanctuary starts to feel socially inhabited.",
      skyClass: "amber" as const,
      phaseLabel: "Amber light",
      environmentalShift: "More lanterns appear and the shoreline begins reflecting warmer light.",
      progress: 0.58,
    };
  }

  return {
    title: "Mist Path",
    note: "The village is calm but subdued. One more completed step pulls extra light into the route.",
    skyClass: "mist" as const,
    phaseLabel: "Lantern mist",
    environmentalShift: "Fog is heavier, the path is narrower, and room glows are sparse.",
    progress: 0.34,
  };
}

export default function WorldPage() {
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("guest");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState("");
  const [activeZoneId, setActiveZoneId] = useState(worldZones[0].id);

  useEffect(() => {
    const storedToken = localStorage.getItem("reclaim_token");
    const storedUserId = localStorage.getItem("reclaim_user_id");
    if (storedToken) setToken(storedToken);
    if (storedUserId) setUserId(storedUserId);
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const loadWorld = async () => {
      setError("");
      try {
        const [tasksRes, progressRes] = await Promise.all([
          fetch(`${apiBase}/tasks/today`, { headers: getAuthHeaders(token) }),
          fetch(`${apiBase}/progress/summary`, { headers: getAuthHeaders(token) }),
        ]);

        if (!tasksRes.ok || !progressRes.ok) {
          throw new Error("Failed to load sanctuary state");
        }

        const [tasksData, progressData] = await Promise.all([tasksRes.json(), progressRes.json()]);
        if (cancelled) return;
        setTasks(tasksData.tasks || []);
        setSummary(progressData);
      } catch (err) {
        if (cancelled) return;
        setError("Failed to load the sanctuary. Try refreshing in a moment.");
        console.error(err);
      }
    };

    void loadWorld();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const persona = useMemo(() => getPersonaForUser(userId || "guest"), [userId]);
  const worldState = useMemo(() => getWorldState(summary), [summary]);
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.day_in_week || 0) - (b.day_in_week || 0)),
    [tasks]
  );
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const activeTask = sortedTasks.find((task) => task.status !== "completed") || null;
  const activeZone = worldZones.find((zone) => zone.id === activeZoneId) ?? worldZones[0];
  const checkpointIndex = sortedTasks.length === 0 ? 0 : Math.min(completedCount, sortedTasks.length - 1);
  const checkpointDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const checkpoints = sortedTasks.map((task, index) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dayLabel: checkpointDays[(task.day_in_week || index + 1) - 1] || `Day ${index + 1}`,
  }));
  const level = completedCount + 1;

  if (!token) {
    return (
      <EmptyState
        icon="World"
        title="Sign In Required"
        description="Sign in to enter your sanctuary and see your recovery world."
        action={{ label: "Go to Sign In", onClick: () => (window.location.href = "/auth") }}
      />
    );
  }

  return (
    <div className={`world-page-shell world-theme-${worldState.skyClass}`}>
      <section className="world-app-shell">
        <div className="world-page-heading">
          <div>
            <p className="world-kicker">Persistent sanctuary</p>
            <h1>{worldState.title}</h1>
            <p className="world-page-subtitle">{worldState.note}</p>
          </div>
          <div className="world-chip-row">
            <span className="world-chip">{persona.archetype}</span>
            <span className="world-chip">{worldState.phaseLabel}</span>
            <span className="world-chip">{summary?.streak_days ?? 0} day streak</span>
            <span className="world-chip">{completedCount} lit rooms</span>
          </div>
        </div>

        <WorldExplorerScene
          zones={worldZones}
          activeZoneId={activeZoneId}
          onZoneSelect={setActiveZoneId}
          worldPhase={worldState.skyClass}
          progress={worldState.progress}
          personaColors={{
            primary: persona.palette.primary,
            secondary: persona.palette.secondary,
          }}
          checkpoints={checkpoints}
          currentCheckpointIndex={checkpointIndex}
          level={level}
        />
      </section>

      <section className="world-stat-grid">
        <article className="world-stat-card">
          <p className="world-stat-label">Current route</p>
          <strong>{activeZone.title}</strong>
          <span>{activeZone.note}</span>
        </article>
        <article className="world-stat-card">
          <p className="world-stat-label">World energy</p>
          <strong>{summary?.total_xp ?? 0}</strong>
          <span>XP translated into scene brightness, path glow, and room presence</span>
        </article>
        <article className="world-stat-card">
          <p className="world-stat-label">Next mission</p>
          <strong>{activeTask ? activeTask.title : "Week complete"}</strong>
          <span>{activeTask ? "Walk to the task board or enter a room from the map." : "The next board will brighten the sanctuary further."}</span>
        </article>
      </section>

      <section className="world-grid">
        <div className="world-panel world-panel-plain">
          <p className="world-kicker">Metaverse shift</p>
          <h2>This is now a navigable world, not a page of links.</h2>
          <div className="world-shift-list">
            <div>
              <strong>Embodied movement</strong>
              <p>The avatar walks through the sanctuary instead of jumping between dashboard cards.</p>
            </div>
            <div>
              <strong>Camera presence</strong>
              <p>The camera follows your destination, tightening the sense of being inside one persistent space.</p>
            </div>
            <div>
              <strong>Room entry flow</strong>
              <p>Each landmark now behaves like a place you approach and enter, not a generic node in a ring.</p>
            </div>
          </div>
        </div>

        <div className="world-panel world-panel-soft">
          <p className="world-kicker">Environmental response</p>
          <div className="world-theme-stack">
            <div>
              <strong>Light state</strong>
              <p>{worldState.environmentalShift}</p>
            </div>
            <div>
              <strong>Scene blend</strong>
              <p>Forest retreat for warmth, lantern city for silhouette and signal, coastal village for openness and breath.</p>
            </div>
            <div>
              <strong>Next step</strong>
              <p>The next major upgrade is true room transitions so entering a destination shifts you into its own 3D subspace.</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="app-panel critical">
          <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
        </div>
      )}
    </div>
  );
}
