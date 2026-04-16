"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getJourneyRatio, getPersonaForUser, type AvatarPersona } from "@/lib/avatar-journey";

const STORAGE_PREFIX = "reclaim-avatar-journey";

type UseAvatarJourneyParams = {
  userId: string;
  completedTasks: number;
  totalTasks: number;
};

type JourneySnapshot = {
  progress: number;
  completedTasks: number;
  totalTasks: number;
};

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function readSnapshot(userId: string): JourneySnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JourneySnapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(userId: string, snapshot: JourneySnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(snapshot));
}

export function useAvatarJourney({ userId, completedTasks, totalTasks }: UseAvatarJourneyParams) {
  const persona = useMemo<AvatarPersona>(() => getPersonaForUser(userId || "guest"), [userId]);
  const liveProgress = getJourneyRatio(completedTasks, totalTasks);
  const [displayProgress, setDisplayProgress] = useState(liveProgress);
  const previousProgressRef = useRef(liveProgress);

  useEffect(() => {
    const snapshot = readSnapshot(userId);
    if (snapshot) {
      setDisplayProgress(snapshot.progress);
      previousProgressRef.current = snapshot.progress;
    }
  }, [userId]);

  useEffect(() => {
    const nextProgress = liveProgress;
    setDisplayProgress((current) => {
      const resolved = nextProgress;
      writeSnapshot(userId, { progress: resolved, completedTasks, totalTasks });
      previousProgressRef.current = resolved;
      return resolved;
    });
  }, [completedTasks, liveProgress, totalTasks, userId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(userId) || !event.newValue) return;
      try {
        const snapshot = JSON.parse(event.newValue) as JourneySnapshot;
        setDisplayProgress(snapshot.progress);
      } catch {
        return;
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId]);

  const celebrate = totalTasks > 0 && completedTasks === totalTasks;

  return {
    persona,
    displayProgress,
    previousProgress: previousProgressRef.current,
    celebrate,
  };
}
