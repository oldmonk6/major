"use client";

import React from "react";

import { AvatarFigure } from "@/components/avatar-figure";
import { getJourneyRatio, getPersonaForUser, sampleJourneyUsers } from "@/lib/avatar-journey";

export function CommunityPulseCard() {
  return (
    <section className="community-pulse-card">
      <div className="community-pulse-head">
        <div>
          <p className="journey-kicker">Circle Pulse</p>
          <h3>Community momentum</h3>
          <p className="journey-subtitle">
            A premium social loop should let people feel progress together. This preview shows how
            a community rail can surface wins, streaks, and gentle accountability.
          </p>
        </div>
        <div className="community-pulse-badge">Live-ready UI</div>
      </div>

      <div className="community-pulse-list">
        {sampleJourneyUsers.map((user) => {
          const persona = getPersonaForUser(user.id);
          const ratio = getJourneyRatio(user.completedTasks, user.totalTasks);
          return (
            <article key={user.id} className="community-pulse-item">
              <div className="community-pulse-avatar">
                <AvatarFigure persona={persona} size={68} walking={false} />
              </div>
              <div className="community-pulse-copy">
                <div className="community-pulse-row">
                  <strong>{user.name}</strong>
                  <span>{user.streak}-day streak</span>
                </div>
                <p>{user.status}</p>
                <div className="community-pulse-progress">
                  <div className="community-pulse-progress-bar">
                    <div style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <span>{user.completedTasks}/{user.totalTasks} done</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
