"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function FloatingPoints() {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(1600 * 3);
    for (let i = 0; i < 1600; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 11;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.028;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
  });

  return (
    <points ref={pointsRef} frustumCulled>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        transparent
        color="#7b203a"
        size={0.028}
        sizeAttenuation
        depthWrite={false}
        opacity={0.55}
      />
    </points>
  );
}

function OrbitRings() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = state.clock.elapsedTime * 0.08;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.14) * 0.35;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2.7, 0, 0]}>
        <torusGeometry args={[1.4, 0.01, 16, 120]} />
        <meshBasicMaterial color="#7b203a" transparent opacity={0.24} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, 0.2, 0.3]}>
        <torusGeometry args={[2.1, 0.012, 16, 140]} />
        <meshBasicMaterial color="#d4b996" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

function BreathingOrb() {
  const orbRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!orbRef.current) return;
    const s = 0.78 + Math.sin(state.clock.elapsedTime * 1.1) * 0.05;
    orbRef.current.scale.set(s, s, s);
    orbRef.current.rotation.y = state.clock.elapsedTime * 0.2;
  });

  return (
    <mesh ref={orbRef} position={[0, -0.15, -0.45]}>
      <icosahedronGeometry args={[0.85, 3]} />
      <meshStandardMaterial color="#d4b996" emissive="#7b203a" emissiveIntensity={0.14} roughness={0.62} metalness={0.12} />
    </mesh>
  );
}

export default function LandingScene() {
  return (
    <div className="landing-three-bg" aria-hidden>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 58 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 2, 3]} intensity={0.5} color="#fff7ee" />
        <pointLight position={[-2, -1, 2]} intensity={0.32} color="#7b203a" />
        <BreathingOrb />
        <OrbitRings />
        <FloatingPoints />
      </Canvas>
    </div>
  );
}
