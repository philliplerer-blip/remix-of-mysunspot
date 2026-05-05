// 🌿 represents hops (no dedicated hops emoji exists in Unicode).
// Do not extend this list without a deliberate product decision.
export const ALLOWED_STATUS_EMOJI = [
  "🍎", "🍊", "🍌", "🍇", "🍓", "🍉", "🍑", "🍒", "🍍", "🌿",
] as const;

export type StatusEmoji = typeof ALLOWED_STATUS_EMOJI[number];

export const STATUS_EMOJI_LABELS: Record<StatusEmoji, string> = {
  "🍎": "Apple",
  "🍊": "Orange",
  "🍌": "Banana",
  "🍇": "Grapes",
  "🍓": "Strawberry",
  "🍉": "Watermelon",
  "🍑": "Peach",
  "🍒": "Cherry",
  "🍍": "Pineapple",
  "🌿": "Hops",
};

export function isAllowedStatusEmoji(v: unknown): v is StatusEmoji {
  return typeof v === "string" && (ALLOWED_STATUS_EMOJI as readonly string[]).includes(v);
}