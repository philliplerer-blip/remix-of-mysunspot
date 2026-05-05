## Goal
Make the web app feel like an iOS app — without adding Capacitor or a service worker. The bar list becomes a dedicated scroll region inside a fixed-height "phone screen", and we add the iOS niceties (safe areas, momentum, tap feedback, blurred tab bar).

## Changes

### 1. Layout: scrollable bar list inside a fixed screen
`src/pages/Index.tsx`
- Outer `<main>` becomes `h-[100dvh]` and the inner panel becomes a flex column that fills it.
- Header, weather strip, filter chips, and the map keep their natural height (non-scrolling).
- The bar list section becomes `flex-1 min-h-0 overflow-y-auto` so only the cards scroll.
- The legend + "N bars in view" line stays pinned above the scroll region.
- `BottomNav` stays sticky at the bottom of the panel.
- Add `scroll-snap-type: y proximity` on the list and `scroll-snap-align: start` on each card row for a subtle settle.

### 2. Safe areas + iOS meta
`index.html`
- Update viewport meta to `width=device-width, initial-scale=1, viewport-fit=cover`
- Add:
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
  - `<meta name="apple-mobile-web-app-title" content="Sunny Bars">`
  - `<meta name="theme-color" content="#3d1500">`
  - `<meta name="format-detection" content="telephone=no">`

`src/index.css`
- Add safe-area utility classes (`pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`) using `env(safe-area-inset-*)`.
- Apply `pt-safe` to the header, `pb-safe` to `BottomNav`.
- Set body font stack to `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`.
- Globals: `-webkit-tap-highlight-color: transparent`, `-webkit-touch-callout: none`, `text-size-adjust: 100%`.
- `html, body { overscroll-behavior: none; }` to kill whole-page rubber-band; the list container gets `overscroll-behavior: contain` so its bounce is isolated.
- `.momentum-scroll { -webkit-overflow-scrolling: touch; }` applied to the list.
- Hide scrollbars on the list (already a pattern in the codebase).

### 3. Touch / tap feedback
`src/components/BarCard.tsx`
- Add `touch-action: manipulation` and `active:scale-[0.99] active:opacity-95 transition-transform` on the article.
- `scroll-snap-align: start` on the article.
- On click handler, call `navigator.vibrate?.(8)` (no-op on iOS, light haptic on Android).

`src/components/BottomNav.tsx`
- Translucent blurred background: `bg-espresso/80 backdrop-blur-xl`.
- Add `pb-safe` so it clears the home indicator.
- Bump tap targets to min 44×44 (`min-h-11`).
- `touch-action: manipulation` on each NavLink.

### 4. Sticky filter chips
`src/pages/Index.tsx`
- Wrap the filter row in `sticky top-0 z-10` inside the scroll region's parent (or keep above scroll region) with a translucent backdrop so it feels like an iOS segmented header. Decide on whichever lines up cleanly with the existing map block — placed above the scroll region (non-sticky) is simplest and matches current visual hierarchy.

### Files touched
- `index.html`
- `src/index.css`
- `src/pages/Index.tsx`
- `src/components/BarCard.tsx`
- `src/components/BottomNav.tsx`

### Out of scope
- Capacitor / native wrapper
- Service worker / PWA install flow
- Real haptics (requires native)
