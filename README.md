# Sunny Bars

Find sun-drenched terraces in Copenhagen, save favorites, and tell a small circle of friends where you're sitting right now.

---

## Friends + Presence

An intentional, small-graph social layer modeled on *Beer With Me*. Friends are added one of two ways only: scan a QR or look up an exact `@handle`. No fuzzy search, no contacts import, no "people you may know."

### Data model

| Table | Purpose | Key columns |
|---|---|---|
| `profiles.handle` | Immutable `@handle`, 3–20 chars `[a-z0-9_]`. Set once, enforced by trigger. | `handle UNIQUE` |
| `friendships` | Friend graph. Pair stored canonically (`user_a < user_b`) so each pair appears at most once. | `user_a`, `user_b`, `requested_by`, `status ∈ {pending, accepted, blocked}` |
| `presence_sessions` | Ephemeral "I'm doing X right now" rows. Capped at 4h via CHECK constraint. | `user_id`, `activity`, `bar_id?`, `location_lat/lng?`, `started_at`, `expires_at` |
| `active_presence_sessions` (view) | Same shape as above, but filters `expires_at > now()` and **nulls `location_*` for expired rows** as a defense-in-depth layer. | — |
| `profiles.{status_emoji, status_text, status_updated_at, visibility}` | Profile / presence-on-profile fields. `visibility ∈ {friends_only, private}`. `status_emoji` is locked to a 10-symbol allowlist by trigger. | — |

**RLS guarantees:**
- `friendships`: only the two participants can read, update, or delete a row. Inserts must come from the requester and be a participant.
- `presence_sessions`: owner sees everything they own; *other users see a row only if* `(a)` they are accepted friends with the owner AND `(b)` `expires_at > now()`. Non-friends never see anything. Expired rows never expose location.
- `profiles`: **direct table reads are restricted to the owner only.** All other access goes through two SECURITY DEFINER RPCs:
  - `get_profile_for_viewer(_target_handle)` — runs `can_view_profile(viewer, target)` and returns 0 rows on default-deny. Maps to **404** in the UI for both "no such handle" and "not allowed."
  - `list_visible_friend_summaries()` — returns `{user_id, handle, display_name, status_emoji, friendship_id, status, requested_by}` for accepted friends + pending requests. **`status_emoji` is null when `can_view_profile` is false** (e.g. the other side went private).

### `can_view_profile(viewer, target)` contract

Returns `true` **only if all** hold:
1. `viewer == target` (self always sees self), **OR**
2. an accepted `friendships` row exists for the canonical pair `{viewer, target}`, AND
3. no `blocked` row exists for that pair (in either direction — block is a hard cut), AND
4. `target.visibility != 'private'`.

Pending requests count for nothing. The helper is the **only** way profile data leaves the server. Any new endpoint that returns profile fields must route through it.

**Server-side expiry:** RLS already filters expired rows from friends' queries. A pg_cron job (`cleanup_expired_presence`, hourly) hard-deletes rows expired > 24h.

### Endpoints (Edge Functions)

All require a valid Supabase JWT in `Authorization: Bearer …`.

#### `POST /friends-qr/mint`
Mints a 24h HMAC-signed invite token for the caller.
```json
→ { "token": "...", "expiresAt": 1735689600000,
    "deepLink": "sunnybars://add?u=<uid>&t=<token>",
    "webLink":  "https://app.example.com/friends/add?u=<uid>&t=<token>" }
```
The QR encodes `webLink` (universal link, works in any browser → opens the PWA). The `deepLink` is included for a future native wrapper.

#### `POST /friends-qr/verify`  `{ token }`
Returns `{ userId }` if signature valid and not expired. `400` malformed/invalid signature, `410` expired.

#### `POST /friends-actions/by-handle`  `{ handle }`
Looks up exact handle, then sends a friend request via the `send_friend_request(uuid)` RPC. **Returns the same generic `{ ok, message }` whether the handle existed or not** — prevents handle-existence enumeration. `403` only on `blocked` (existing relationship).

#### `POST /friends-actions/by-token`  `{ userId, token }`
Verifies the token belongs to `userId`, then sends the request.

#### `POST /friends-actions/respond`  `{ friendshipId, action }`
`action ∈ { "accept" | "decline" | "remove" | "block" }`. Caller must be a participant. Cannot accept your own outgoing request.

#### `POST /profile-update`  `{ display_name?, status_emoji?, status_text?, visibility? }`
Updates the caller's own profile only. Validation:
- `display_name`: 1–40 chars; control chars stripped.
- `status_emoji`: must be one of `["🍎","🍊","🍌","🍇","🍓","🍉","🍑","🍒","🍍","🌿"]` or `null`. Anything else → 400. The DB trigger enforces the same allowlist as a second line of defense.
- `status_text`: ≤60 chars, plain text. Stored verbatim — never parsed as HTML or markdown. React escapes on render.
- `visibility`: `'friends_only'` (default) or `'private'`.
- `status_updated_at` only bumps when emoji or text actually changes.

### Status emoji allowlist

Source of truth lives in two places that must stay in sync:
1. DB function `public.is_allowed_status_emoji` + the `validate_profile_status` trigger.
2. `src/lib/profile-emoji.ts` (`ALLOWED_STATUS_EMOJI`) — used by the UI picker and edge function reject path.

🌿 stands in for hops (no dedicated hops emoji exists in Unicode). Do not extend the list without a deliberate product decision.

### Deep link format

- **Web (active):** `https://<host>/friends/add?u=<userId>&t=<token>` — handled by `/friends/add` route, which auto-fires the request and redirects to `/friends`.
- **Custom scheme (future):** `sunnybars://add?u=<userId>&t=<token>` — minted alongside the web link, only resolves once the app is wrapped natively.

### Out of scope (not built, by design)

Chat, push notifications, group sessions, public/global feed, follower model, contact import, "people you may know," profile photos beyond emoji-or-initial.

**Rate limiting** (handle lookups, friend-request sends): the spec asks for 30/min, 100/day. The Lovable Cloud backend currently has no shared rate-limiting primitive (cross-instance counters), so this is **deferred** to when proper infrastructure lands. The default-deny + generic-response design above already removes the most useful enumeration signal; volume limits are still desirable.

### Tests

`bun run test` runs the Vitest suite. Tests hit the live Lovable Cloud backend (skipped if `VITE_SUPABASE_URL` isn't set):

- `src/test/friends.test.ts` — QR token expiry, duplicate-friendship prevention, non-friend session isolation, expired-session filtering, blocked-user request rejection. (5 tests)
- `src/test/profile.test.ts` — self/friend/pending/non-friend visibility, handle-enumeration parity, private-overrides-friendship, block revokes both directions, emoji allowlist (🌿 accepted, 🍺 / 🌱 / 🍃 / 🍻 / `X` rejected with stored value unchanged), `<script>`/markdown stored as literal text, list endpoint hides emoji for non-visible users. (15 tests)

**Status: 21/21 passing** as of last run.
