## Problem

When you ran `npx cap add ios`, Capacitor rejected the App ID:

```
Invalid App ID "app.lovable.1f83bf48a013467b8c2943fb8efc3112"
- Each segment must start with a letter.
```

The third segment (`1f83bf48...`) starts with the digit `1`, which is not allowed. iOS and Android both require every dot-separated segment of the bundle ID to start with a letter (a–z, A–Z).

## Fix

Update `capacitor.config.ts` and change the `appId` from:

```
app.lovable.1f83bf48a013467b8c2943fb8efc3112
```

to:

```
app.lovable.p1f83bf48a013467b8c2943fb8efc3112
```

(adding a `p` prefix so the segment starts with a letter, while keeping it unique to your project). No other changes.

## What you do after I apply the fix

In your terminal, from the project folder, run these one at a time:

```
npm install
npx cap add ios
npx cap sync
npx cap open ios
```

Notes:
- Always use `npx cap ...`, never `cap ...` on its own — `cap` isn't installed globally, but `npx` runs the local copy from `node_modules`.
- You don't need `cap init` again — your `capacitor.config.ts` already exists.
- `npx cap add ios` is the step that creates the `ios/` folder; that's why `npx cap update ios` failed earlier ("ios platform has not been added yet").
