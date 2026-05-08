# Restaurant Push Notifications & Venue Dashboard

A new "Venue Partner" side of MySunSpot where restaurants/bars can log in, see how many users have been near their venue recently, pay per blast, and send a push that appears both as in-app news and as an iOS push notification.

## 1. Roles & accounts

New `app_role` enum: `user`, `venue_owner`, `admin`. Stored in a separate `user_roles` table (never on `profiles`) with a `has_role()` security-definer function — required to avoid RLS recursion and privilege escalation.

New table `venue_claims`:
- `venue_id` → `bars_directory.id`
- `user_id`, `business_name`, `contact_email`, `phone`
- `status`: `pending` | `approved` | `rejected`
- `submitted_at`, `reviewed_at`, `reviewed_by`

Flow: restaurant signs up at `/venue/auth` → fills claim form picking their venue from `bars_directory` → admin approves in an admin screen → on approval, the user is granted `venue_owner` role and linked to that venue.

## 2. Venue partner dashboard (`/venue`)

Separate route tree, protected by a `RequireVenueOwner` guard. Pages:
- **Dashboard**: live count of users near the venue (1 km, last 14 days), hourly trend chart for the last 24 h, recent blast history.
- **Send blast**: title + body + optional link, preview, "Send for X kr" button → Stripe Checkout.
- **Billing**: list of past payments and receipts.
- **Settings**: business contact info.

## 3. Nearby user count

New table `user_location_pings` (lightweight, append-only):
- `user_id`, `lat`, `lng`, `seen_at`
- Written from the existing geolocation hook every ~5 min while app is open.
- Indexed on `(seen_at)` and a coarse geohash for fast radius queries.
- 30-day retention via cron cleanup.

Two security-definer RPCs callable only by `venue_owner` for their own venue:
- `venue_nearby_count(venue_id)` → distinct users with a ping in last 14 days within 1 km.
- `venue_hourly_trend(venue_id)` → array of {hour, count} for last 24 h.

Returns counts only — never user identities or coordinates.

## 4. Payments (Stripe pay-per-blast)

Use Lovable's built-in Stripe Payments (no BYOK). One Stripe product "Push Notification Blast" with a fixed price (e.g. 99 DKK). Flow:
1. Edge function `create-blast-checkout` creates a Stripe Checkout Session with metadata `{ venue_id, draft_blast_id }`. A `blasts` row is inserted with `status = 'pending_payment'`.
2. Stripe webhook edge function `stripe-webhook` flips the blast to `status = 'paid'` and triggers the send.
3. Edge function `send-venue-blast` does the actual fan-out.

`blasts` table: `id`, `venue_id`, `sent_by`, `title`, `body`, `link_url`, `status`, `recipients_count`, `stripe_session_id`, `paid_at`, `sent_at`.

## 5. Audience & delivery

Audience = users with at least one ping within 1 km in the last 14 days, who:
- have notifications enabled in `notification_settings`,
- have a token in `device_tokens` (iOS via APNs) or `web_push_subscriptions`.

Delivery in `send-venue-blast`:
- iOS push via APNs using a new edge function (requires APNs auth key — added as a secret).
- Web push via existing VAPID setup.
- Insert one row per recipient into a new `news_items` table so the blast also appears as in-app news.

New `news_items` table: `id`, `user_id`, `venue_id`, `blast_id`, `title`, `body`, `link_url`, `created_at`, `read_at`. RLS: user can read/update only their own rows.

In the existing app, add a "News" tab/badge in `BottomNav` showing unread count from `news_items`.

## 6. iOS / Xcode side

The app already uses Capacitor. To send real iOS push notifications:
- Add `@capacitor/push-notifications` plugin.
- In Xcode: enable Push Notifications + Background Modes (Remote notifications) capabilities.
- In Apple Developer: create an APNs Auth Key (.p8), note Key ID + Team ID.
- Store APNs key, Key ID, Team ID, and bundle ID as Lovable Cloud secrets.
- On app start, register for push and upsert the APNs token into `device_tokens` with `platform = 'ios'`.
- `send-venue-blast` signs a JWT and posts to `https://api.push.apple.com/3/device/<token>` for each iOS recipient.

User must run `npx cap sync ios` and rebuild in Xcode after these changes.

## 7. Admin review screen

Simple `/admin/venue-claims` page (gated by `admin` role) listing pending claims with Approve / Reject buttons. Approval grants the `venue_owner` role and writes the venue link.

## Technical details

```
Tables added:
  user_roles (id, user_id, role)
  venue_claims (...)
  venue_owners (user_id, venue_id)        -- approved links
  user_location_pings (user_id, lat, lng, seen_at, geohash5)
  blasts (...)
  news_items (...)

RPCs:
  has_role(_user_id, _role)
  venue_nearby_count(_venue_id)
  venue_hourly_trend(_venue_id)

Edge functions:
  create-blast-checkout       -- Stripe Checkout session
  stripe-webhook              -- payment confirmation
  send-venue-blast            -- fan-out to APNs + web push + news_items
  apns-send (helper module)
  cleanup-location-pings (cron, daily)

Frontend routes:
  /venue/auth
  /venue                       -- dashboard
  /venue/send
  /venue/billing
  /admin/venue-claims
  /news                        -- in-app news feed for end users

Secrets needed:
  APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID
  (Stripe is handled by Lovable Payments, no manual key)
```

## Open items before build

- Confirm blast price (e.g. 99 DKK) and currency.
- Confirm 14-day "recently near" window (vs 7 or 30).
- Confirm minimum interval between blasts per venue (suggest: max 1/day, 3/week) to protect users from spam.
- Confirm whether end users can opt out of venue blasts separately from sun alerts (recommended: yes, a toggle in notification settings).

Once you approve this, I'll implement it in stages: roles + claims first, then dashboard + nearby count, then Stripe + APNs + send pipeline.
