export type AvatarPersona = {
  id: string;
  title: string;
  archetype: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
    skin: string;
  };
  outfit: string;
  accessory: string;
  mood: string;
};

export type JourneySampleUser = {
  id: string;
  name: string;
  archetype: string;
  completedTasks: number;
  totalTasks: number;
  streak: number;
  status: string;
  aura: string;
};

export const avatarPersonas: AvatarPersona[] = [
  {
    id: "trailblazer",
    title: "Ari Sol",
    archetype: "Trailblazer",
    palette: {
      primary: "#7d3546",
      secondary: "#f1d2b0",
      accent: "#f7f0e4",
      glow: "rgba(125, 53, 70, 0.28)",
      skin: "#f4d0b4",
    },
    outfit: "Structured coat",
    accessory: "Compass pin",
    mood: "steady",
  },
  {
    id: "sentinel",
    title: "Mira Vale",
    archetype: "Sentinel",
    palette: {
      primary: "#30566d",
      secondary: "#d6e6ee",
      accent: "#f4fbff",
      glow: "rgba(48, 86, 109, 0.24)",
      skin: "#f0c4a4",
    },
    outfit: "Field jacket",
    accessory: "Signal band",
    mood: "focused",
  },
  {
    id: "gardener",
    title: "Noor Ember",
    archetype: "Gardener",
    palette: {
      primary: "#4f6b3d",
      secondary: "#dbe7c8",
      accent: "#f5f3e7",
      glow: "rgba(79, 107, 61, 0.24)",
      skin: "#efc7aa",
    },
    outfit: "Soft knit layer",
    accessory: "Leaf charm",
    mood: "calm",
  },
  {
    id: "voyager",
    title: "Lio Hart",
    archetype: "Voyager",
    palette: {
      primary: "#5a3f75",
      secondary: "#e2d9f1",
      accent: "#f8f3ff",
      glow: "rgba(90, 63, 117, 0.23)",
      skin: "#f1ceb0",
    },
    outfit: "Utility cape",
    accessory: "Star clasp",
    mood: "curious",
  },
];

export const sampleJourneyUsers: JourneySampleUser[] = [
  {
    id: "sample-1",
    name: "Zara",
    archetype: "Sentinel",
    completedTasks: 6,
    totalTasks: 8,
    streak: 9,
    status: "Closed her evening loop before 9 PM.",
    aura: "Holding a strong evening routine.",
  },
  {
    id: "sample-2",
    name: "Dev",
    archetype: "Gardener",
    completedTasks: 3,
    totalTasks: 5,
    streak: 4,
    status: "Finished a grounding task during a rough hour.",
    aura: "Momentum is building today.",
  },
  {
    id: "sample-3",
    name: "Ira",
    archetype: "Trailblazer",
    completedTasks: 5,
    totalTasks: 5,
    streak: 12,
    status: "Reached a milestone and unlocked a new path marker.",
    aura: "Celebrating a full completion day.",
  },
];

export const sampleTasks = [
  { id: "sample-task-1", title: "Morning reset", status: "completed" as const, xp: 20 },
  { id: "sample-task-2", title: "Movement break", status: "completed" as const, xp: 15 },
  { id: "sample-task-3", title: "Focused work block", status: "pending" as const, xp: 25 },
  { id: "sample-task-4", title: "Reflect and plan", status: "pending" as const, xp: 20 },
];

export const journeyMilestones = [
  { label: "Start", shortLabel: "Start", ratio: 0 },
  { label: "Settling In", shortLabel: "1", ratio: 0.25 },
  { label: "Strong Rhythm", shortLabel: "2", ratio: 0.5 },
  { label: "Momentum", shortLabel: "3", ratio: 0.75 },
  { label: "Day Complete", shortLabel: "4", ratio: 1 },
];

function hashString(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPersonaForUser(seed: string) {
  const index = hashString(seed) % avatarPersonas.length;
  return avatarPersonas[index];
}

export function getJourneyRatio(completedTasks: number, totalTasks: number) {
  if (totalTasks <= 0) return 0;
  return Math.max(0, Math.min(1, completedTasks / totalTasks));
}

export function getNextMilestone(progress: number) {
  return journeyMilestones.find((milestone) => progress < milestone.ratio) ?? journeyMilestones[journeyMilestones.length - 1];
}

export function getCompletedMilestoneCount(progress: number) {
  return journeyMilestones.filter((milestone) => progress >= milestone.ratio).length;
}
