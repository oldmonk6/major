"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type SceneZone = {
  id: string;
  href: string;
  title: string;
  label: string;
  note: string;
  color: string;
  position: [number, number, number];
  kind?: "cabin" | "pool" | "tower" | "archive";
};

type TaskCheckpoint = {
  id: string;
  title: string;
  status: "pending" | "completed";
  dayLabel: string;
};

type WorldExplorerSceneProps = {
  zones: SceneZone[];
  activeZoneId: string;
  onZoneSelect: (zoneId: string) => void;
  worldPhase: "dawn" | "mist" | "amber" | "golden";
  progress: number;
  personaColors: {
    primary: string;
    secondary: string;
  };
  checkpoints: TaskCheckpoint[];
  currentCheckpointIndex: number;
  level: number;
};

function checkpointPosition(index: number, total: number) {
  const t = total <= 1 ? 0 : index / (total - 1);
  const x = -4.7 + t * 9.2;
  const z = 1.1 + Math.sin(t * Math.PI * 1.1) * 1.8 - t * 3.6;
  return new THREE.Vector3(x, 0.18, z);
}

function CameraRig({
  avatarTarget,
  focusTarget,
}: {
  avatarTarget: THREE.Vector3;
  focusTarget: THREE.Vector3;
}) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    desired.current.set(
      avatarTarget.x * 0.55 + focusTarget.x * 0.12,
      4.4,
      Math.max(avatarTarget.z + 6.3, 4.8)
    );
    lookAt.current.set(
      (avatarTarget.x + focusTarget.x * 0.22) * 0.8,
      0.85,
      (avatarTarget.z + focusTarget.z * 0.16) * 0.84
    );

    camera.position.lerp(desired.current, 1 - Math.exp(-delta * 1.7));
    camera.lookAt(lookAt.current);
  });

  return null;
}

function AmbientParticles({ phase }: { phase: "dawn" | "mist" | "amber" | "golden" }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = phase === "golden" ? 320 : phase === "amber" ? 260 : 210;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 4.8 + 0.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.025;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={phase === "golden" ? "#ffe39c" : phase === "amber" ? "#ffd5a1" : "#d9e8ff"}
        transparent
        opacity={phase === "mist" ? 0.24 : 0.38}
        size={0.05}
        depthWrite={false}
      />
    </points>
  );
}

function OpenWorldGround({ phase }: { phase: "dawn" | "mist" | "amber" | "golden" }) {
  const groundColor =
    phase === "golden" ? "#6cc96c" :
    phase === "amber" ? "#5bb561" :
    phase === "mist" ? "#4fa25a" :
    "#61bb68";

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color={groundColor} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -5.1]}>
        <planeGeometry args={[22, 4.8]} />
        <meshStandardMaterial color="#58a9d8" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.9, -6.4]}>
        <boxGeometry args={[12.5, 2.6, 1.2]} />
        <meshStandardMaterial color="#2d5f5f" roughness={1} />
      </mesh>
      <mesh position={[-6.1, 1.4, -3.6]}>
        <coneGeometry args={[3.2, 4, 8]} />
        <meshStandardMaterial color="#3e8348" roughness={1} />
      </mesh>
      <mesh position={[6.2, 1.5, -3.8]}>
        <coneGeometry args={[3.4, 4.4, 8]} />
        <meshStandardMaterial color="#3a7d45" roughness={1} />
      </mesh>
    </>
  );
}

function WorldRoads() {
  const roadSegments = [
    { position: [-3.15, 0.03, 0.4], rotation: -0.46, scale: 5.4 },
    { position: [0.15, 0.03, -0.45], rotation: -0.14, scale: 5.9 },
    { position: [3.2, 0.03, -1.8], rotation: -0.42, scale: 4.8 },
    { position: [-3.8, 0.03, -1.25], rotation: 0.68, scale: 3.3 },
    { position: [4.05, 0.03, 0.7], rotation: -0.78, scale: 2.8 },
  ];

  return (
    <>
      {roadSegments.map((segment, index) => (
        <mesh
          key={index}
          rotation={[-Math.PI / 2, 0, segment.rotation]}
          position={[segment.position[0], segment.position[1], segment.position[2]]}
        >
          <planeGeometry args={[segment.scale, 0.48]} />
          <meshStandardMaterial color="#f8faf7" roughness={0.88} />
        </mesh>
      ))}
    </>
  );
}

function CheckpointPath({
  checkpoints,
  currentCheckpointIndex,
}: {
  checkpoints: TaskCheckpoint[];
  currentCheckpointIndex: number;
}) {
  const glowRef = useRef<Array<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null>>([]);

  useFrame((state) => {
    glowRef.current.forEach((mesh, index) => {
      if (!mesh) return;
      const pulse = 0.26 + Math.abs(Math.sin(state.clock.elapsedTime * 1.5 + index * 0.4)) * 0.18;
      mesh.material.opacity = index <= currentCheckpointIndex ? pulse : 0.08;
    });
  });

  return (
    <>
      {checkpoints.map((checkpoint, index) => {
        const position = checkpointPosition(index, checkpoints.length);
        const unlocked = index <= currentCheckpointIndex;
        return (
          <group key={checkpoint.id} position={[position.x, 0, position.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
              <circleGeometry args={[0.38, 24]} />
              <meshStandardMaterial color={unlocked ? "#ffbf75" : "#e9f0e6"} roughness={0.52} />
            </mesh>
            <mesh
              ref={(node) => {
                if (node) {
                  glowRef.current[index] = node as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
                }
              }}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.02, 0]}
            >
              <circleGeometry args={[0.58, 24]} />
              <meshBasicMaterial color="#ffd987" transparent opacity={unlocked ? 0.3 : 0.08} />
            </mesh>
            <mesh position={[0, 0.34, 0]}>
              <sphereGeometry args={[0.12, 18, 18]} />
              <meshStandardMaterial color={unlocked ? "#ffd379" : "#f6fbf5"} emissive={unlocked ? "#ffce6a" : "#ffffff"} emissiveIntensity={unlocked ? 0.9 : 0.1} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function AvatarWalker({
  target,
  colors,
  level,
}: {
  target: THREE.Vector3;
  colors: { primary: string; secondary: string };
  level: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const current = groupRef.current.position.clone();
    const planarTarget = target.clone();
    planarTarget.y = 0.18;

    const next = current.lerp(planarTarget, 1 - Math.exp(-delta * 2.1));
    groupRef.current.position.set(next.x, 0.18, next.z);

    if (next.distanceTo(planarTarget) > 0.02) {
      const lookTarget = planarTarget.clone();
      lookTarget.y = groupRef.current.position.y;
      groupRef.current.lookAt(lookTarget);
    }

    const moving = next.distanceTo(planarTarget) > 0.04;
    const walkBob = moving ? Math.sin(state.clock.elapsedTime * 8) * 0.06 : Math.sin(state.clock.elapsedTime * 2) * 0.02;
    groupRef.current.position.y = 0.18 + Math.abs(walkBob) * 0.08;

    if (auraRef.current) {
      auraRef.current.scale.setScalar(0.95 + Math.abs(Math.sin(state.clock.elapsedTime * 1.4)) * 0.12);
      auraRef.current.material.opacity = 0.16 + Math.abs(Math.sin(state.clock.elapsedTime * 1.8)) * 0.12;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.18, 1.25]}>
      <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <circleGeometry args={[0.6, 28]} />
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.24} />
      </mesh>

      <mesh position={[0, 0.92, 0]}>
        <capsuleGeometry args={[0.22, 0.28, 8, 12]} />
        <meshStandardMaterial color={colors.secondary} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <torusGeometry args={[0.28, 0.05, 12, 28]} />
        <meshStandardMaterial color="#ff7f3d" roughness={0.42} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.24, 0.52, 8, 12]} />
        <meshStandardMaterial color={colors.primary} roughness={0.38} />
      </mesh>

      <mesh position={[-0.16, 0.34, 0]}>
        <capsuleGeometry args={[0.07, 0.42, 6, 10]} />
        <meshStandardMaterial color={colors.primary} roughness={0.44} />
      </mesh>
      <mesh position={[0.16, 0.34, 0]}>
        <capsuleGeometry args={[0.07, 0.42, 6, 10]} />
        <meshStandardMaterial color={colors.primary} roughness={0.44} />
      </mesh>

      <mesh position={[-0.1, -0.02, 0]}>
        <capsuleGeometry args={[0.07, 0.5, 6, 10]} />
        <meshStandardMaterial color={colors.primary} roughness={0.42} />
      </mesh>
      <mesh position={[0.1, -0.02, 0]}>
        <capsuleGeometry args={[0.07, 0.5, 6, 10]} />
        <meshStandardMaterial color={colors.primary} roughness={0.42} />
      </mesh>

      <mesh position={[0.24, 1.18, 0]}>
        <sphereGeometry args={[0.12 + Math.min(level, 9) * 0.01, 16, 16]} />
        <meshStandardMaterial color="#ffd46f" emissive="#ffcc62" emissiveIntensity={0.78} />
      </mesh>
    </group>
  );
}

function FeatureStructure({
  zone,
  selected,
  onSelect,
}: {
  zone: SceneZone;
  selected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = zone.position[1] + Math.sin(state.clock.elapsedTime * 1.3 + zone.position[0]) * 0.04;
  });

  return (
    <group ref={groupRef} position={zone.position} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[selected ? 0.92 : 0.78, 24]} />
        <meshBasicMaterial color={zone.color} transparent opacity={selected ? 0.22 : 0.12} />
      </mesh>

      {zone.kind === "cabin" && (
        <>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.05, 0.62, 0.82]} />
            <meshStandardMaterial color="#8a5e3d" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <coneGeometry args={[0.86, 0.55, 4]} />
            <meshStandardMaterial color="#6d4432" roughness={0.9} />
          </mesh>
        </>
      )}

      {zone.kind === "pool" && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.86, 0.9, 0.12, 24]} />
            <meshStandardMaterial color="#e2f6ff" roughness={0.34} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
            <circleGeometry args={[0.66, 24]} />
            <meshStandardMaterial color="#76daf3" metalness={0.12} roughness={0.2} />
          </mesh>
        </>
      )}

      {zone.kind === "tower" && (
        <>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 1.35, 10]} />
            <meshStandardMaterial color="#7a6660" roughness={0.82} />
          </mesh>
          <mesh position={[0, 1.46, 0]}>
            <sphereGeometry args={[0.22, 18, 18]} />
            <meshStandardMaterial color="#ffd274" emissive="#ffc75f" emissiveIntensity={selected ? 1.4 : 0.8} />
          </mesh>
        </>
      )}

      {zone.kind === "archive" && (
        <>
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.92, 0.78, 0.82]} />
            <meshStandardMaterial color="#59487d" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.96, 0]}>
            <sphereGeometry args={[0.2, 18, 18]} />
            <meshStandardMaterial color="#c9bbff" emissive="#c9bbff" emissiveIntensity={selected ? 1.2 : 0.48} />
          </mesh>
        </>
      )}
    </group>
  );
}

function SceneContent({
  zones,
  activeZoneId,
  onZoneSelect,
  worldPhase,
  checkpoints,
  currentCheckpointIndex,
  level,
  personaColors,
}: WorldExplorerSceneProps) {
  const avatarTarget = useMemo(
    () => checkpointPosition(Math.min(currentCheckpointIndex, Math.max(checkpoints.length - 1, 0)), Math.max(checkpoints.length, 1)),
    [checkpoints.length, currentCheckpointIndex]
  );
  const focusZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];
  const focusTarget = useMemo(
    () => new THREE.Vector3(focusZone.position[0], focusZone.position[1], focusZone.position[2]),
    [focusZone]
  );

  return (
    <>
      <fog attach="fog" args={[worldPhase === "golden" ? "#8bd67b" : "#84c97a", 7, 18]} />
      <ambientLight intensity={0.82} color="#f7fff0" />
      <directionalLight position={[5, 8, 5]} intensity={1.3} color={worldPhase === "golden" ? "#ffe4a2" : "#fff8e7"} />
      <pointLight position={[0, 4, -4]} intensity={0.9} color="#9bd7ff" />

      <CameraRig avatarTarget={avatarTarget} focusTarget={focusTarget} />
      <AmbientParticles phase={worldPhase} />
      <OpenWorldGround phase={worldPhase} />
      <WorldRoads />
      <CheckpointPath checkpoints={checkpoints} currentCheckpointIndex={currentCheckpointIndex} />
      <AvatarWalker target={avatarTarget} colors={personaColors} level={level} />

      {zones.map((zone) => (
        <FeatureStructure
          key={zone.id}
          zone={zone}
          selected={zone.id === activeZoneId}
          onSelect={() => onZoneSelect(zone.id)}
        />
      ))}
    </>
  );
}

export function WorldExplorerScene(props: WorldExplorerSceneProps) {
  const activeZone = props.zones.find((zone) => zone.id === props.activeZoneId) ?? props.zones[0];
  const currentCheckpoint = props.checkpoints[props.currentCheckpointIndex] ?? null;

  return (
    <div className="world-explorer-shell">
      <div className="world-explorer-stage">
        <Canvas camera={{ position: [0, 4.4, 6.6], fov: 46 }}>
          <SceneContent {...props} />
        </Canvas>
      </div>

      <div className="world-explorer-overlay">
        <div className="world-explorer-banner">
          <div>
            <p className="world-kicker">Open world sanctuary</p>
            <h2>{currentCheckpoint ? currentCheckpoint.title : activeZone.title}</h2>
            <p>
              {currentCheckpoint
                ? `Your 3D character stands at the ${currentCheckpoint.dayLabel} checkpoint and automatically moves forward when that task is completed.`
                : activeZone.note}
            </p>
          </div>
          <a href={activeZone.href} className="world-inline-action">
            Open {activeZone.title}
          </a>
        </div>

        <div className="world-destination-dock">
          <div className="world-checkpoint-head">
            <div>
              <span>Character progression</span>
              <strong>Level {props.level}</strong>
            </div>
            <p>
              The world path tracks your current task. Feature buildings stay accessible at all times.
            </p>
          </div>

          <div className="world-feature-dock">
            {props.zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`world-feature-pill${zone.id === props.activeZoneId ? " active" : ""}`}
                onClick={() => props.onZoneSelect(zone.id)}
              >
                <span>{zone.label}</span>
                <strong>{zone.title}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
