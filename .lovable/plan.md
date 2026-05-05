## Make the app responsive for iOS and Android

Goal: one mobile-first layout that fills the screen edge-to-edge on phones (iOS Safari, Android Chrome, PWAs), respects each platform's safe areas and system UI, and still looks good on tablets/desktop.

### What's wrong today

- Header has two clocks and a tall subtitle block, eating ~150px on small screens.
- Map locks to 250–430px regardless of device height, leaving the bar list squeezed (especially on Android phones with on-screen nav).
- Bottom nav label "Settings & Favorites" wraps awkwardly on narrow widths (≤360px Android).
- Cross-platform basics missing: no Android `theme-color` handling for light/dark, no `<html>` background, no PWA manifest, no Android status-bar / gesture-inset handling, font stack is iOS-only.
- No dynamic viewport handling — `100dvh` is used in one place but several inner sections use fixed heights; Android Chrome's collapsing URL bar and iOS keyboard cause layout jumps.

### Plan

1. Cross-platform shell (`index.html`, `index.css`, `main.tsx`)
   - Set proper title + description.
   - Add both light and dark `theme-color` meta tags so Android tints the status bar correctly and iOS PWA matches.
   - Add a minimal `manifest.webmanifest` (name, icons, display: standalone, background/theme colors) so the app is installable on Android and iOS.
   - Font stack: extend to include `Roboto`, `"Noto Sans"`, `system-ui` after the Apple stack so Android renders in its native font instead of falling back to serif.
   - Set `html, body { background: hsl(var(--espresso)); }` so the area behind safe-area insets matches the header on both platforms (no white flash on overscroll).

2. Responsive viewport sizing
   - Replace ad-hoc `100dvh` usage with a CSS custom property `--app-h: 100dvh` (with `100vh` fallback) and use `min-h-[var(--app-h)]` for the main container.
   - Make the map height fluid: `h-[clamp(180px,32svh,360px)]` collapsed and `clamp(260px,46svh,460px)` expanded. Uses `svh` so it doesn't jump when Android's URL bar collapses.
   - Ensure the bar-list section is the flex-grow region (`flex-1 min-h-0`) and the only scroller; everything else is sticky/fixed sized.

3. Safe-area + system UI (iOS notch + Android gesture bar)
   - Confirm `viewport-fit=cover` (already present).
   - Use `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe` utilities on the outer `<main>` instead of just the header, so landscape iPhones don't clip content behind the notch.
   - BottomNav: keep `pb-safe` and add `min-height: calc(56px + env(safe-area-inset-bottom))` so Android 3-button nav doesn't overlap.

4. Tighten the header (saves ~120px)
   - Remove the duplicate clock in the top-right (keep date + time once).
   - Drop the subtitle line; merge "Live sun finder" + location into one compact row.
   - Make the weather card a single-row strip (icon · short status · sun%).

5. Bar list & cards
   - Cards: `p-3 sm:p-4`, larger tap targets (min 44px on iOS, 48dp on Android) for the heart and select areas.
   - Add `content-visibility: auto` on offscreen cards for smoother Android scrolling.
   - Keep momentum scrolling utility; add `overscroll-behavior-y: contain` on the list and `none` on `<html>` (already set) so pull-to-refresh doesn't fight the in-app scroll.

6. BottomNav fixes
   - Shorten label "Settings & Favorites" → "Favorites".
   - Use `text-[0.65rem]` on ≤360px (`xs:` breakpoint via Tailwind config) to prevent wrap.
   - Ensure each tab is ≥48dp tall.

7. Tablet/desktop preserved
   - Keep the existing `sm:` "phone frame" centered card (max-w 430px). On `lg+`, allow a wider 2-column layout (map left, list right) — optional, behind the same `sm:` breakpoint we already use, so no regressions.

### Technical notes

- Files touched: `index.html`, `public/manifest.webmanifest` (new), `src/index.css`, `src/pages/Index.tsx`, `src/components/BottomNav.tsx`, `src/components/BarCard.tsx`, `tailwind.config.ts` (add `xs: 360px` breakpoint).
- No new dependencies. Pure CSS/Tailwind + meta tags.
- `svh`/`dvh` units are supported in iOS Safari 15.4+ and Android Chrome 108+; `vh` fallback kept.
- `content-visibility` is Chromium-only — graceful no-op on Safari.
- Native packaging (Capacitor) is not part of this change; this is web-only responsive polish.

### What you'll notice

- App fills the phone screen edge-to-edge with no white bars.
- Status bar tinted to match the header on both iOS and Android.
- Bar list gets ~150px more vertical room and scrolls smoothly.
- Bottom nav labels no longer wrap on small Android devices.
- Installable as a PWA from Android Chrome's "Add to Home screen" with proper icon/colors.
