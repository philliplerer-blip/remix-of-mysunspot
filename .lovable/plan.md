## Match Friends & Profile to the Discover/Favorites iOS layout

Right now Discover and Favorites render inside a centered, rounded "phone frame" card (max-width 430px, espresso header, app-gradient backdrop, BottomNav inside the card). Friends and Profile use a flat full-bleed `bg-espresso` layout, so on iPad/desktop they look like a different app and on phones the header styling doesn't match.

### Shared shell to apply

Both pages get wrapped in the exact same outer structure used by `Favorites.tsx`:

```text
<main class="min-h-screen bg-app-gradient px-4 py-4 sm:py-8">
  <section class="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px]
                  flex-col overflow-hidden rounded-[2rem] border border-butter/60
                  bg-background shadow-panel animate-rise-in">
    <header class="bg-espresso px-5 pb-5 pt-3 text-secondary"> … </header>
    <section class="flex-1 bg-background px-4 py-4"> … page content … </section>
    <BottomNav … />
  </section>
</main>
```

### Friends page (`src/pages/Friends.tsx`)

- Replace the current `<main className="flex min-h-app flex-col bg-espresso …">` wrapper with the phone-frame shell.
- Move the title block ("Friends" + subtitle) into the espresso header, styled like Favorites' header (small uppercase eyebrow + `font-display text-3xl` title + muted subtitle).
- Move the handle-setup `Card`, the `Tabs`, and all `TabsContent` into the inner `bg-background` section so they sit on the light card background like Favorites' content list.
- Render `<BottomNav />` as the last child of the inner section (inside the card), not outside.
- Keep all functional logic (handlers, state, scanner, presence) untouched.

### Profile page (`src/pages/Profile.tsx`)

- Same shell wrapper.
- Header: eyebrow ("Your profile" / "Profile") + `font-display` title; for own profile, show `@handle` as the muted subtitle.
- Inner section hosts the existing profile card, edit card, and QR card.
- Loading and "not found" states also use the shell (so the frame is visible while loading), matching the rest of the app.
- BottomNav moves inside the card, identical to Favorites.

### Visual details to align

- Inner cards switch from `border-butter/30 bg-espresso-light` to the Favorites convention: `rounded-2xl border border-border bg-card` so they read as light cards on the light inner background. (Tabs content cards in Friends, plus Profile's three cards.)
- Section headings use `mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground` like Favorites' "Favorites" heading.
- Tabs `TabsList` keeps `grid-cols-3` but sits at the top of the inner section with `mb-3`.

### Out of scope

- No changes to BottomNav, routes, data fetching, edge functions, or the proximity feature.
- No changes to Discover or Favorites.
- Tests and types unchanged.

### Files to edit

- `src/pages/Friends.tsx`
- `src/pages/Profile.tsx`
