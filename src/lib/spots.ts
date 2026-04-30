export type SpotIcon = "bench" | "hill" | "park" | "pier" | "stairs" | "tree" | "other";

export interface CustomSpot {
  id: string;
  name: string;
  note: string;
  icon: SpotIcon;
  x: number;
  y: number;
  createdAt: number;
}

export const spotIcons: { key: SpotIcon; label: string; emoji: string }[] = [
  { key: "bench", label: "Bench", emoji: "🪑" },
  { key: "hill", label: "Hill", emoji: "⛰️" },
  { key: "park", label: "Park", emoji: "🌿" },
  { key: "pier", label: "Pier", emoji: "⚓" },
  { key: "stairs", label: "Stairs", emoji: "🪜" },
  { key: "tree", label: "Tree", emoji: "🌳" },
  { key: "other", label: "Other", emoji: "📍" },
];

export const spotEmoji = (icon: SpotIcon) =>
  spotIcons.find((entry) => entry.key === icon)?.emoji ?? "📍";