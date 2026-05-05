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

**RLS guarantees:**
- `friendships`: only the two participants can read, update, or delete a row. Inserts must come from the requester and be a participant.
- `presence_sessions`: owner sees everything they own; *other users see a row only if* `(a)` they are accepted friends with the owner AND `(b)` `expires_at > now()`. Non-friends never see anything. Expired rows never expose location.
- `profiles`: a signed-in user can look up another profile only if its `handle` is set (needed for friend-by-handle).

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
Looks up exact handle, then sends a friend request via the `send_friend_request(uuid)` RPC. Returns `404` if no such handle, `403` if blocked.

#### `POST /friends-actions/by-token`  `{ userId, token }`
Verifies the token belongs to `userId`, then sends the request.

#### `POST /friends-actions/respond`  `{ friendshipId, action }`
`action ∈ { "accept" | "decline" | "remove" | "block" }`. Caller must be a participant. Cannot accept your own outgoing request.

### Deep link format

- **Web (active):** `https://<host>/friends/add?u=<userId>&t=<token>` — handled by `/friends/add` route, which auto-fires the request and redirects to `/friends`.
- **Custom scheme (future):** `sunnybars://add?u=<userId>&t=<token>` — minted alongside the web link, only resolves once the app is wrapped natively.

### Out of scope (not built, by design)

Chat, push notifications, group sessions, public/global feed, follower model.

### Tests

`bun run test` runs the Vitest suite. `src/test/friends.test.ts` hits the live Lovable Cloud backend and covers QR token expiry, duplicate-friendship prevention, non-friend isolation, expired-session filtering, and blocked-user request rejection. The suite is auto-skipped if `VITE_SUPABASE_URL` isn't set.
