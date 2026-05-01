export type SunState = "sun" | "soon" | "shade";
export type Filter = "all" | "sun" | "soon" | "cheap";

export interface Bar {
  id: number;
  name: string;
  area: string;
  state: SunState;
  beer: number;
  dist: string;
  start: number;
  end: number;
  x: number;
  y: number;
  vibe: string;
  lat: number;
  lng: number;
}

export const nowHour = 16.35;

export const bars: Bar[] = [
  { id: 0, name: "Toldboden", area: "Harbour terrace", state: "sun", beer: 65, dist: "0.4 km", start: 14.25, end: 20.5, x: 38, y: 34, vibe: "Waterfront spritz", lat: 55.6909, lng: 12.5994 },
  { id: 1, name: "Halvandet", area: "Refshaleøen", state: "sun", beer: 75, dist: "1.2 km", start: 15.0, end: 21.25, x: 58, y: 54, vibe: "Golden hour deck", lat: 55.6948, lng: 12.6107 },
  { id: 2, name: "Palægade Bar", area: "Indre By", state: "soon", beer: 72, dist: "0.8 km", start: 17.25, end: 19.75, x: 27, y: 63, vibe: "Street-side apéro", lat: 55.6837, lng: 12.5885 },
  { id: 3, name: "Nørreport Øl", area: "Market edge", state: "shade", beer: 60, dist: "1.5 km", start: 12.25, end: 15.25, x: 67, y: 27, vibe: "Easy meetup", lat: 55.6831, lng: 12.5712 },
  { id: 4, name: "Christiania Pub", area: "Canal walk", state: "soon", beer: 55, dist: "2.1 km", start: 17.75, end: 21.0, x: 44, y: 75, vibe: "Late sun tables", lat: 55.6736, lng: 12.5988 },
];

export const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All bars" },
  { key: "sun", label: "Sun now" },
  { key: "soon", label: "Sun later" },
  { key: "cheap", label: "Cheap" },
];

export const stateCopy = {
  sun: { label: "Sunny now", tone: "bg-sun text-espresso", dot: "bg-sun", glow: "animate-sun-pulse" },
  soon: { label: "Sun later", tone: "bg-flame text-primary-foreground", dot: "bg-flame", glow: "" },
  shade: { label: "Mostly shade", tone: "bg-shade text-primary-foreground", dot: "bg-coral", glow: "" },
} as const;

export const formatHour = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};