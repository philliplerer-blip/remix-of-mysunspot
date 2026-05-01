export type SpotIcon = "bench" | "hill" | "park" | "pier" | "stairs" | "tree" | "other";

export interface CustomSpot {
  id: string;
  name: string;
  note: string;
  icon: SpotIcon;
  x: number;
  y: number;
  lat: number;
  lng: number;
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

// Map base — Copenhagen center. Map x/y (0-100%) translate to a small lat/lng box.
export const MAP_CENTER = { lat: 55.6833, lng: 12.5833 };
export const MAP_SPAN = { lat: 0.04, lng: 0.07 }; // ~4km x ~5km box

export const xyToLatLng = (x: number, y: number) => ({
  // y=0 is top of map = north → higher lat
  lat: MAP_CENTER.lat + (0.5 - y / 100) * MAP_SPAN.lat,
  lng: MAP_CENTER.lng + (x / 100 - 0.5) * MAP_SPAN.lng,
});