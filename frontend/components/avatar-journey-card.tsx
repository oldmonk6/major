"use client";

import React from "react";
import { motion } from "framer-motion";

import { AvatarFigure } from "@/components/avatar-figure";
import {
  getCompletedMilestoneCount,
  getNextMilestone,
  journeyMilestones,
  type AvatarPersona,
} from "@/lib/avatar-journey";

export function AvatarJourneyCard({
  persona,
  progress,
  completedTasks,
  totalTasks,
  walking,
  celebrate,
}: {
  persona: AvatarPersona;
  progress: number;
  completedTasks: number;
  totalTasks: number;
  walking: boolean;
  celebrate: boolean;
}) {
  const nextMilestone = getNextMilestone(progress);
  const completedMilestones = getCompletedMilestoneCount(progress);

  return (
    <section
      className="journey-card"
      style={
        {
          "--journey-primary": persona.palette.primary,
          "--journey-glow": persona.palette.glow,
          "--journey-secondary": persona.palette.secondary,
        } as React.CSSProperties
      }
    >
      <div className="journey-card-head">
        <div>
          <p className="journey-kicker">Personal Journey</p>
          <h2>{persona.title}</h2>
          <p className="journey-subtitle">
            Your {persona.archetype.toLowerCase()} persona advances each time you finish a task.
            The path is persistent, visible, and designed to reward consistency.
          </p>
        </div>
        <div className="journey-card-meta">
          <span className="journey-chip">{persona.outfit}</span>
          <span className="journey-chip">{persona.accessory}</span>
        </div>
      </div>

      <div className="journey-stage">
        <div className="journey-stage-glow" />
        <div className="journey-progress-copy">
          <div>
            <p className="journey-metric-label">Today</p>
            <div className="journey-metric-value">
              {completedTasks}/{totalTasks || 0}
            </div>
          </div>
          <div>
            <p className="journey-metric-label">Next Checkpoint</p>
            <div className="journey-metric-note">{nextMilestone.label}</div>
          </div>
          <div>
            <p className="journey-metric-label">Milestones</p>
            <div className="journey-metric-note">{completedMilestones} unlocked</div>
          </div>
        </div>

        <div className="journey-track-shell">
          <div className="journey-track-line" />
          <motion.div
            className="journey-track-fill"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.8 }}
          />

          {journeyMilestones.map((milestone) => {
            const unlocked = progress >= milestone.ratio;
            return (
              <div
                key={milestone.label}
                className={`journey-checkpoint${unlocked ? " unlocked" : ""}`}
                style={{ left: `${milestone.ratio * 100}%` }}
              >
                <div className="journey-checkpoint-core">{milestone.shortLabel}</div>
                <div className="journey-checkpoint-label">{milestone.label}</div>
              </div>
            );
          })}

          <motion.div
            className="journey-avatar-rail"
            initial={false}
            animate={{ left: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 75, damping: 17, mass: 0.95 }}
          >
            <AvatarFigure persona={persona} size={96} walking={walking} />
          </motion.div>

          {celebrate && (
            <div className="journey-celebration" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, index) => (
                <motion.span
                  key={index}
                  className="journey-confetti"
                  initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.4, 1, 0.8],
                    x: [0, (index - 5.5) * 14],
                    y: [0, -18 - (index % 4) * 12],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.35, delay: index * 0.04 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
