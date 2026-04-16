"use client";

import React from "react";
import { motion } from "framer-motion";

import type { AvatarPersona } from "@/lib/avatar-journey";

export function AvatarFigure({
  persona,
  size = 84,
  walking = false,
}: {
  persona: AvatarPersona;
  size?: number;
  walking?: boolean;
}) {
  const bodyWidth = size * 0.44;
  const headSize = size * 0.26;
  const armHeight = size * 0.2;
  const legHeight = size * 0.22;

  return (
    <motion.div
      className="journey-avatar"
      animate={walking ? { y: [0, -4, 0], rotate: [0, 1.5, 0, -1.5, 0] } : { y: 0, rotate: 0 }}
      transition={walking ? { duration: 0.72, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      style={
        {
          "--avatar-primary": persona.palette.primary,
          "--avatar-secondary": persona.palette.secondary,
          "--avatar-accent": persona.palette.accent,
          "--avatar-glow": persona.palette.glow,
          "--avatar-skin": persona.palette.skin,
          width: `${size}px`,
          height: `${size}px`,
        } as React.CSSProperties
      }
    >
      <div className="journey-avatar-glow" />
      <div className="journey-avatar-shadow" />
      <div className="journey-avatar-head" style={{ width: headSize, height: headSize }} />
      <div className="journey-avatar-hair" style={{ width: headSize * 1.08, height: headSize * 0.66 }} />
      <div className="journey-avatar-body" style={{ width: bodyWidth, height: size * 0.38 }}>
        <div className="journey-avatar-accessory">{persona.accessory}</div>
      </div>
      <motion.div
        className="journey-avatar-arm left"
        animate={walking ? { rotate: [22, -10, 22] } : { rotate: 12 }}
        transition={walking ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        style={{ width: size * 0.09, height: armHeight }}
      />
      <motion.div
        className="journey-avatar-arm right"
        animate={walking ? { rotate: [-22, 10, -22] } : { rotate: -12 }}
        transition={walking ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        style={{ width: size * 0.09, height: armHeight }}
      />
      <motion.div
        className="journey-avatar-leg left"
        animate={walking ? { rotate: [-24, 16, -24] } : { rotate: -8 }}
        transition={walking ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        style={{ width: size * 0.1, height: legHeight }}
      />
      <motion.div
        className="journey-avatar-leg right"
        animate={walking ? { rotate: [24, -16, 24] } : { rotate: 8 }}
        transition={walking ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        style={{ width: size * 0.1, height: legHeight }}
      />
      <div className="journey-avatar-badge">{persona.archetype}</div>
    </motion.div>
  );
}
