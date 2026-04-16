"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import * as THREE from "three";

type StickmanJourneyCardProps = {
  progress: number;
  completedTasks: number;
  totalTasks: number;
  walking: boolean;
  celebrate: boolean;
};

const progressMilestones = [
  { label: "Start", ratio: 0 },
  { label: "Settled", ratio: 0.33 },
  { label: "Steady", ratio: 0.66 },
  { label: "Today closed", ratio: 1 },
];

function getNextMilestone(progress: number) {
  return progressMilestones.find((milestone) => progress < milestone.ratio) ?? progressMilestones[progressMilestones.length - 1];
}

function ProgressTrack({ progress, walking, celebrate }: { progress: number; walking: boolean; celebrate: boolean }) {
  const walkerRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>(null);
  const burstRef = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(-1.8 + progress * 3.6, -1.15, 0));

  useEffect(() => {
    target.current.set(-1.8 + progress * 3.6, -1.15, 0);
  }, [progress]);

  useFrame((state, delta) => {
    if (!walkerRef.current) return;

    walkerRef.current.position.lerp(target.current, 1 - Math.exp(-delta * 3.4));
    const moving = walking || walkerRef.current.position.distanceTo(target.current) > 0.02;
    const cycle = state.clock.elapsedTime * (moving ? 7.2 : 1.8);
    const swing = moving ? Math.sin(cycle) * 0.58 : Math.sin(cycle) * 0.08;
    const bob = moving ? Math.abs(Math.sin(cycle)) * 0.05 : Math.sin(cycle) * 0.01;

    walkerRef.current.position.y = -1.15 + bob;
    walkerRef.current.position.z = bob * 0.1;
    walkerRef.current.rotation.z = moving ? Math.sin(cycle) * 0.03 : 0;

    if (leftArmRef.current) leftArmRef.current.rotation.z = swing;
    if (rightArmRef.current) rightArmRef.current.rotation.z = -swing;
    if (leftLegRef.current) leftLegRef.current.rotation.z = -swing * 0.9;
    if (rightLegRef.current) rightLegRef.current.rotation.z = swing * 0.9;

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.abs(Math.sin(state.clock.elapsedTime * 1.8)) * 0.15);
      glowRef.current.material.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 1.8)) * 0.08;
    }

    if (burstRef.current) {
      burstRef.current.visible = celebrate;
      burstRef.current.children.forEach((child, index) => {
        const mesh = child as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
        mesh.position.x = Math.cos(state.clock.elapsedTime * 1.8 + index) * (0.45 + (index % 3) * 0.14);
        mesh.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 2.4 + index * 0.7) * 0.32;
        mesh.position.z = Math.sin(state.clock.elapsedTime * 1.6 + index) * 0.22;
      });
    }
  });

  return (
    <>
      <group position={[0, -0.25, -0.4]}>
        {Array.from({ length: 9 }).map((_, index) => {
          const x = -1.95 + index * 0.5;
          const y = -1.6 + Math.sin(index * 0.6) * 0.08;
          return (
            <group key={index} position={[x, y, 0]}>
              <mesh rotation={[-0.66, 0.18, 0]}>
                <boxGeometry args={[0.82, 0.1, 0.55]} />
                <meshStandardMaterial color={index / 8 <= progress ? "#7b203a" : "#ead9c2"} roughness={0.82} />
              </mesh>
              <mesh position={[0, -0.1, -0.24]}>
                <boxGeometry args={[0.82, 0.22, 0.08]} />
                <meshStandardMaterial color="#d4b996" roughness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>

      <mesh position={[0, 0.2, -1.45]} rotation={[0, 0.12, 0]}>
        <planeGeometry args={[5.2, 2.6]} />
        <meshBasicMaterial color="#fff6ea" transparent opacity={0.08} />
      </mesh>

      <mesh ref={glowRef} position={[0.05, 0.25, -0.55]}>
        <sphereGeometry args={[1.55, 24, 24]} />
        <meshBasicMaterial color="#d4b996" transparent opacity={0.18} />
      </mesh>

      <group ref={walkerRef} position={[-1.8, -1.15, 0]}>
        <mesh position={[0, 0.72, 0.02]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#2e1f1f" roughness={0.28} />
        </mesh>

        <mesh position={[0, 0.24, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.78, 12]} />
          <meshStandardMaterial color="#2e1f1f" roughness={0.34} />
        </mesh>

        <group ref={leftArmRef} position={[0, 0.42, 0]}>
          <mesh position={[0.18, -0.16, 0]} rotation={[0, 0, -0.92]}>
            <cylinderGeometry args={[0.018, 0.018, 0.48, 12]} />
            <meshStandardMaterial color="#2e1f1f" roughness={0.34} />
          </mesh>
        </group>

        <group ref={rightArmRef} position={[0, 0.42, 0]}>
          <mesh position={[-0.18, -0.16, 0]} rotation={[0, 0, 0.92]}>
            <cylinderGeometry args={[0.018, 0.018, 0.48, 12]} />
            <meshStandardMaterial color="#2e1f1f" roughness={0.34} />
          </mesh>
        </group>

        <group ref={leftLegRef} position={[0, -0.14, 0]}>
          <mesh position={[0.16, -0.28, 0]} rotation={[0, 0, -0.58]}>
            <cylinderGeometry args={[0.018, 0.018, 0.66, 12]} />
            <meshStandardMaterial color="#2e1f1f" roughness={0.34} />
          </mesh>
        </group>

        <group ref={rightLegRef} position={[0, -0.14, 0]}>
          <mesh position={[-0.16, -0.28, 0]} rotation={[0, 0, 0.58]}>
            <cylinderGeometry args={[0.018, 0.018, 0.66, 12]} />
            <meshStandardMaterial color="#2e1f1f" roughness={0.34} />
          </mesh>
        </group>
      </group>

      <group ref={burstRef}>
        {Array.from({ length: 9 }).map((_, index) => (
          <mesh key={index}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? "#7b203a" : "#d4b996"}
              emissive={index % 2 === 0 ? "#7b203a" : "#d4b996"}
              emissiveIntensity={0.28}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function StickmanJourneyCard({
  progress,
  completedTasks,
  totalTasks,
  walking,
  celebrate,
}: StickmanJourneyCardProps) {
  const nextMilestone = getNextMilestone(progress);
  const completedMilestones = progressMilestones.filter((milestone) => progress >= milestone.ratio).length;

  return (
    <section className="ascent-card">
      <div className="ascent-card-head">
        <div>
          <p className="journey-kicker">Task Motion</p>
          <h2>Each completed task moves the day forward.</h2>
          <p className="journey-subtitle">
            The stickman walks forward on a clean horizontal route instead of sliding through a world. Motion stays
            legible, calm, and directly tied to task completion.
          </p>
        </div>
        <div className="ascent-card-meta">
          <span className="journey-chip">Three.js scene</span>
          <span className="journey-chip">Walking motion</span>
        </div>
      </div>

      <div className="ascent-stage">
        <div className="ascent-metrics">
          <div>
            <p className="journey-metric-label">Today</p>
            <div className="journey-metric-value">
              {completedTasks}/{totalTasks || 0}
            </div>
          </div>
          <div>
            <p className="journey-metric-label">Next Marker</p>
            <div className="journey-metric-note">{nextMilestone.label}</div>
          </div>
          <div>
            <p className="journey-metric-label">Milestones</p>
            <div className="journey-metric-note">{completedMilestones} cleared</div>
          </div>
        </div>

        <div className="ascent-canvas-shell horizontal">
          <Canvas camera={{ position: [0, 0.2, 4.9], fov: 33 }}>
            <color attach="background" args={["#f8efe3"]} />
            <fog attach="fog" args={["#f8efe3", 3.8, 7]} />
            <ambientLight intensity={1.15} color="#fff7ee" />
            <directionalLight position={[2, 4, 4]} intensity={1.3} color="#fff3dc" />
            <pointLight position={[-2, -1, 2]} intensity={0.7} color="#7b203a" />
            <ProgressTrack progress={progress} walking={walking} celebrate={celebrate} />
          </Canvas>

          <div className="ascent-axis" aria-hidden="true">
            {progressMilestones.map((milestone) => (
              <div
                key={milestone.label}
                className={`ascent-axis-stop${progress >= milestone.ratio ? " active" : ""}`}
                style={{ left: `${8 + milestone.ratio * 76}%` }}
              >
                <span />
                <strong>{milestone.label}</strong>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          className="ascent-progress-bar"
          initial={false}
          animate={{ scaleX: Math.max(progress, 0.03) }}
          transition={{ type: "spring", stiffness: 90, damping: 20, mass: 0.9 }}
        />
      </div>
    </section>
  );
}
