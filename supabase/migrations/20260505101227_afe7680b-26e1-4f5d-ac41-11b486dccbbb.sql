-- 1. Profile flag for proximity notifications (opt-in, default off)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS proximity_notifications_enabled boolean NOT NULL DEFAULT false;

-- 2. Audit log of sent proximity notifications (per ordered pair)
CREATE TABLE IF NOT EXISTS public.proximity_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,           -- recipient
  friend_id uuid NOT NULL,         -- the friend who triggered the alert
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prox_notif_pair_time
  ON public.proximity_notifications (user_id, friend_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_prox_notif_user_day
  ON public.proximity_notifications (user_id, sent_at DESC);

ALTER TABLE public.proximity_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prox notif read own"
  ON public.proximity_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy — only the SECURITY DEFINER server function may write.

-- 3. Per-friend mute
CREATE TABLE IF NOT EXISTS public.friend_proximity_mutes (
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
ALTER TABLE public.friend_proximity_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpm read own" ON public.friend_proximity_mutes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fpm insert own" ON public.friend_proximity_mutes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fpm delete own" ON public.friend_proximity_mutes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Web Push subscriptions (browser endpoints)
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wps_user ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wps read own" ON public.web_push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wps insert own" ON public.web_push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wps update own" ON public.web_push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wps delete own" ON public.web_push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Native device tokens (APNs / FCM) — adapter is a stub for now
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  app_version text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dt_user ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dt read own" ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dt insert own" ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dt update own" ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dt delete own" ON public.device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Updated-at trigger reuse
DROP TRIGGER IF EXISTS trg_wps_updated_at ON public.web_push_subscriptions;
CREATE TRIGGER trg_wps_updated_at BEFORE UPDATE ON public.web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_dt_updated_at ON public.device_tokens;
CREATE TRIGGER trg_dt_updated_at BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Block-purge: when a friendship row is set to 'blocked', wipe related state
CREATE OR REPLACE FUNCTION public.purge_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'blocked') THEN
    -- Remove mutes either direction (no longer meaningful)
    DELETE FROM public.friend_proximity_mutes
     WHERE (user_id = NEW.user_a AND friend_id = NEW.user_b)
        OR (user_id = NEW.user_b AND friend_id = NEW.user_a);
    -- Don't delete audit history; it's needed for abuse investigation.
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_friendships_purge_on_block ON public.friendships;
CREATE TRIGGER trg_friendships_purge_on_block
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.purge_on_block();

-- 8. Server-side proximity evaluator. Called from the edge function with the
-- viewer's freshly-stored session location. Returns ordered pairs (recipient,
-- friend, friend_display_name, friend_status_emoji) that should receive an
-- alert NOW. Applies every gate from spec section 13.1 + 13.5 + 13.7 + 13.8.
CREATE OR REPLACE FUNCTION public.evaluate_proximity(_session_id uuid)
RETURNS TABLE (
  recipient_id uuid,
  friend_id uuid,
  friend_display_name text,
  friend_status_emoji text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid;
  _my_lat double precision;
  _my_lng double precision;
  _my_expires timestamptz;
  _lat_delta double precision := 0.009;            -- ~1km in latitude degrees
  _lng_delta double precision;
BEGIN
  SELECT user_id, location_lat, location_lng, expires_at
    INTO _me, _my_lat, _my_lng, _my_expires
  FROM public.presence_sessions
  WHERE id = _session_id;

  IF _me IS NULL OR _my_lat IS NULL OR _my_lng IS NULL OR _my_expires <= now() THEN
    RETURN;
  END IF;

  -- I must have proximity_notifications_enabled too (for the reverse direction)
  -- But primary direction is "who can I notify": i.e. who should be told that I'm near?
  -- Per spec we notify both sides when both are eligible. The edge function calls
  -- this once per side in symmetric fashion using the same eligibility set.
  _lng_delta := 1.0 / (111.0 * GREATEST(cos(radians(_my_lat)), 0.01));

  RETURN QUERY
  WITH candidates AS (
    SELECT ps.user_id AS other_id,
           ps.location_lat AS other_lat,
           ps.location_lng AS other_lng
    FROM public.presence_sessions ps
    WHERE ps.user_id <> _me
      AND ps.expires_at > now()
      AND ps.location_lat IS NOT NULL
      AND ps.location_lng IS NOT NULL
      AND ps.location_lat BETWEEN _my_lat - _lat_delta AND _my_lat + _lat_delta
      AND ps.location_lng BETWEEN _my_lng - _lng_delta AND _my_lng + _lng_delta
  ),
  -- Haversine distance in meters
  scored AS (
    SELECT c.other_id,
           (
             2 * 6371000 * asin(sqrt(
               sin(radians((c.other_lat - _my_lat)/2))^2
               + cos(radians(_my_lat)) * cos(radians(c.other_lat))
                 * sin(radians((c.other_lng - _my_lng)/2))^2
             ))
           ) AS meters
    FROM candidates c
  ),
  near AS (SELECT * FROM scored WHERE meters <= 1000)
  -- For each near friend, evaluate every gate symmetrically.
  SELECT recipient.id AS recipient_id,
         friend.id AS friend_id,
         friend.display_name,
         friend.status_emoji
  FROM near n
  -- both directions of the pair: (me notifies other) and (other notifies me)
  CROSS JOIN LATERAL (VALUES (_me, n.other_id), (n.other_id, _me)) AS pair(rid, fid)
  JOIN public.profiles recipient ON recipient.id = pair.rid
  JOIN public.profiles friend    ON friend.id    = pair.fid
  WHERE
    -- Both opted in
    recipient.proximity_notifications_enabled = true
    AND friend.proximity_notifications_enabled = true
    -- Neither private
    AND recipient.visibility <> 'private'
    AND friend.visibility    <> 'private'
    -- Mutual visibility (covers accepted friendship + no blocks)
    AND public.can_view_profile(recipient.id, friend.id)
    AND public.can_view_profile(friend.id, recipient.id)
    -- Recipient hasn't muted this friend
    AND NOT EXISTS (
      SELECT 1 FROM public.friend_proximity_mutes m
      WHERE m.user_id = recipient.id AND m.friend_id = friend.id
    )
    -- Cooldown: no notification for this ordered pair in last 2h
    AND NOT EXISTS (
      SELECT 1 FROM public.proximity_notifications p
      WHERE p.user_id = recipient.id
        AND p.friend_id = friend.id
        AND p.sent_at > now() - interval '2 hours'
    )
    -- Daily cap: <10 alerts to recipient in last 24h
    AND (
      SELECT count(*) FROM public.proximity_notifications p
      WHERE p.user_id = recipient.id
        AND p.sent_at > now() - interval '24 hours'
    ) < 10;
END $$;

REVOKE ALL ON FUNCTION public.evaluate_proximity(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_proximity(uuid) TO service_role;

-- 9. Server-only audit writer
CREATE OR REPLACE FUNCTION public.record_proximity_sent(_recipient uuid, _friend uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.proximity_notifications (user_id, friend_id) VALUES (_recipient, _friend);
$$;
REVOKE ALL ON FUNCTION public.record_proximity_sent(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proximity_sent(uuid, uuid) TO service_role;

-- 10. Recent proximity alerts view (last 7 days) — per-user readable via RLS.
-- We build it as a function the client calls via RPC to avoid a SECURITY DEFINER view.
CREATE OR REPLACE FUNCTION public.list_recent_proximity_alerts()
RETURNS TABLE (
  friend_id uuid,
  friend_handle text,
  friend_display_name text,
  sent_at timestamptz,
  muted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.friend_id,
         pr.handle,
         pr.display_name,
         p.sent_at,
         EXISTS (
           SELECT 1 FROM public.friend_proximity_mutes m
            WHERE m.user_id = auth.uid() AND m.friend_id = p.friend_id
         ) AS muted
  FROM public.proximity_notifications p
  JOIN public.profiles pr ON pr.id = p.friend_id
  WHERE p.user_id = auth.uid()
    AND p.sent_at > now() - interval '7 days'
  ORDER BY p.sent_at DESC
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.list_recent_proximity_alerts() TO authenticated;

-- 11. Cleanup helper (call from a scheduled job later)
CREATE OR REPLACE FUNCTION public.cleanup_proximity_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.proximity_notifications WHERE sent_at < now() - interval '30 days';
$$;