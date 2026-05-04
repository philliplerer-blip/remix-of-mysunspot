## Goal
Replace the right-side `Sheet` drawer that currently shows place details with an **inline expansion** of the selected `BarCard` in the list. The card "pops" open in place — staying anchored to its position in the list — and shows the full place details (rating, price, outdoor seating, sun timeline) directly underneath the card header.

## Why this approach
You have three realistic options. Recommended: **Option 1**.

### Option 1 — Inline expanding card (recommended)
The selected `BarCard` grows downward to reveal the details panel. The card stays in its list slot; no overlay, no new surface.

Pros:
- Matches "pop up from the list" literally — the square enlarges out of the row.
- No layering/z-index issues, works perfectly on the 430px mobile frame.
- Keeps map + list visible; user keeps spatial context.
- Smooth height/opacity transition pairs well with existing `animate-rise-in` / `animate-fade-in` utilities.

Cons:
- Long sun-timeline content pushes other cards down (mitigated by auto-scrolling the selected card into view).

### Option 2 — Floating popover anchored to the card
A small panel positioned next to/over the tapped card (Radix Popover).

Pros: doesn't reflow the list.
Cons: on a 430px-wide mobile frame there's nowhere for it to float without covering neighbors; feels like a tooltip, not a "pop-up square".

### Option 3 — Bottom drawer (vaul `Drawer`)
Already available in `src/components/ui/drawer.tsx`.

Pros: mobile-native feel.
Cons: still a separate surface — same UX category as the current `Sheet`, just from the bottom. Doesn't really match "pop up from the list".

## Plan (Option 1)

### 1. `src/components/BarCard.tsx`
- Accept new optional props: `expanded?: boolean`, `details?: DirectoryBar | null`.
- When `expanded` is true, render an extra section below the existing card body containing the details currently shown in the `Sheet`:
  - rating, price level, outdoor-seating line, sun-timeline grid, timeline date.
- Wrap the details section in a `div` with `grid-rows-[0fr]` → `grid-rows-[1fr]` height transition (or simple `max-h` + `transition-all`) plus `animate-fade-in` so it reveals smoothly.
- Apply a subtle "pop" on the card itself when expanded: `scale-[1.01]`, stronger `shadow-sun`, slightly larger padding — so it visually lifts out of the list.

### 2. `src/pages/Index.tsx`
- Remove the `Sheet`/`SheetContent` block at the bottom (lines ~338–end of that block) and the `selectedDirectoryBar` state purpose changes: keep the state but use it only to feed `details` into the expanded `BarCard`, not to open a sheet.
- In the `visibleBars.map(...)` loop, pass `expanded={selected === bar.id}` and `details={selected === bar.id ? matchedDirectoryBar : null}` to each `BarCard`.
- Compute the matched `DirectoryBar` for the active row using the existing `barsInView[bar.id] ?? findNearestDirectoryBar(...)` helper.
- Tapping an already-selected card collapses it (toggle behaviour).
- After expanding, call `element.scrollIntoView({ behavior: "smooth", block: "nearest" })` on the card so the revealed details aren't off-screen.
- Map marker click (`onSelectDirectoryBar`) should now: set `selected` to that bar's id in the list and scroll the list to that card, instead of opening the sheet.

### 3. Cleanup
- Remove unused imports in `Index.tsx`: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` (keep `Star`, `TreePine` only if still used by the moved details — they will be used in `BarCard`).
- Move the `Star` / `TreePine` icon imports into `BarCard.tsx`.

## Out of scope
- No changes to data fetching, weather, or the map.
- No changes to the favorites button behaviour.

## Visual sketch

```text
┌──────────────────────────────┐
│ Toldboden       [Sunny][♥]  │  ← tap
│ ──── sun bar ────            │
└──────────────────────────────┘

           ↓ expands in place ↓

┌──────────────────────────────┐
│ Toldboden       [Sunny][♥]  │
│ ──── sun bar ────            │
│                              │
│ ★ 4.6 / 5    Price: $$       │
│ 🌳 Outdoor seating available │
│ Sun timeline:                │
│  11 12 13 14 15 16 17 18 19  │
│  ☀ ☀ ☀ ☀ ◑ ◑ ☁ ☁ ☁           │
└──────────────────────────────┘
```
