
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('user', 'venue_owner', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ VENUE CLAIMS ============
CREATE TYPE public.venue_claim_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.venue_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.bars_directory(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_email text NOT NULL,
  phone text,
  status public.venue_claim_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  reject_reason text
);
ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims insert own" ON public.venue_claims
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "claims read own" ON public.venue_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "claims read admin" ON public.venue_claims
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "claims update admin" ON public.venue_claims
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ VENUE OWNERS (approved links) ============
CREATE TABLE public.venue_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.bars_directory(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id)
);
ALTER TABLE public.venue_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_venue_owner_of(_user_id uuid, _venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.venue_owners WHERE user_id = _user_id AND venue_id = _venue_id)
$$;

CREATE POLICY "vo read own" ON public.venue_owners
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vo read admin" ON public.venue_owners
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vo insert admin" ON public.venue_owners
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vo delete admin" ON public.venue_owners
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ LOCATION PINGS ============
CREATE TABLE public.user_location_pings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pings_seen_at ON public.user_location_pings(seen_at);
CREATE INDEX idx_pings_user_seen ON public.user_location_pings(user_id, seen_at DESC);
CREATE INDEX idx_pings_latlng ON public.user_location_pings(lat, lng);
ALTER TABLE public.user_location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pings insert own" ON public.user_location_pings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pings read own" ON public.user_location_pings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ BLASTS ============
CREATE TYPE public.blast_status AS ENUM ('pending_payment', 'paid', 'sent', 'failed', 'cancelled');

CREATE TABLE public.blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.bars_directory(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  status public.blast_status NOT NULL DEFAULT 'pending_payment',
  recipients_count integer NOT NULL DEFAULT 0,
  stripe_session_id text,
  amount_dkk integer NOT NULL DEFAULT 49,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  sent_at timestamptz,
  error text
);
CREATE INDEX idx_blasts_venue_created ON public.blasts(venue_id, created_at DESC);
ALTER TABLE public.blasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blasts read venue owner" ON public.blasts
  FOR SELECT TO authenticated USING (public.is_venue_owner_of(auth.uid(), venue_id));
CREATE POLICY "blasts read admin" ON public.blasts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ NEWS ITEMS ============
CREATE TABLE public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.bars_directory(id) ON DELETE CASCADE,
  blast_id uuid REFERENCES public.blasts(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX idx_news_user_created ON public.news_items(user_id, created_at DESC);
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news read own" ON public.news_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "news update own" ON public.news_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ NOTIFICATION SETTINGS: venue blasts toggle ============
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS venue_blasts_enabled boolean NOT NULL DEFAULT true;

-- ============ NEARBY COUNT RPCs (security definer) ============
CREATE OR REPLACE FUNCTION public.venue_nearby_count(_venue_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lat double precision;
  _lng double precision;
  _lat_d double precision := 0.009;
  _lng_d double precision;
  _count integer;
BEGIN
  IF NOT (public.is_venue_owner_of(auth.uid(), _venue_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT lat, lng INTO _lat, _lng FROM public.bars_directory WHERE id = _venue_id;
  IF _lat IS NULL THEN RETURN 0; END IF;
  _lng_d := 1.0 / (111.0 * GREATEST(cos(radians(_lat)), 0.01));
  SELECT count(DISTINCT user_id) INTO _count
  FROM public.user_location_pings
  WHERE seen_at > now() - interval '7 days'
    AND lat BETWEEN _lat - _lat_d AND _lat + _lat_d
    AND lng BETWEEN _lng - _lng_d AND _lng + _lng_d
    AND (
      2 * 6371000 * asin(sqrt(
        sin(radians((lat - _lat)/2))^2
        + cos(radians(_lat)) * cos(radians(lat))
          * sin(radians((lng - _lng)/2))^2
      ))
    ) <= 1000;
  RETURN COALESCE(_count, 0);
END $$;

CREATE OR REPLACE FUNCTION public.venue_hourly_trend(_venue_id uuid)
RETURNS TABLE(hour timestamptz, users integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lat double precision;
  _lng double precision;
  _lat_d double precision := 0.009;
  _lng_d double precision;
BEGIN
  IF NOT (public.is_venue_owner_of(auth.uid(), _venue_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT lat, lng INTO _lat, _lng FROM public.bars_directory WHERE id = _venue_id;
  IF _lat IS NULL THEN RETURN; END IF;
  _lng_d := 1.0 / (111.0 * GREATEST(cos(radians(_lat)), 0.01));
  RETURN QUERY
  WITH hours AS (
    SELECT generate_series(date_trunc('hour', now()) - interval '23 hours',
                           date_trunc('hour', now()), interval '1 hour') AS h
  ),
  near AS (
    SELECT date_trunc('hour', seen_at) AS h, user_id
    FROM public.user_location_pings
    WHERE seen_at > now() - interval '24 hours'
      AND lat BETWEEN _lat - _lat_d AND _lat + _lat_d
      AND lng BETWEEN _lng - _lng_d AND _lng + _lng_d
      AND (2 * 6371000 * asin(sqrt(
            sin(radians((lat - _lat)/2))^2
            + cos(radians(_lat)) * cos(radians(lat))
              * sin(radians((lng - _lng)/2))^2))) <= 1000
  )
  SELECT hours.h, COALESCE(count(DISTINCT near.user_id), 0)::integer
  FROM hours LEFT JOIN near ON near.h = hours.h
  GROUP BY hours.h ORDER BY hours.h;
END $$;

-- ============ BLAST RATE LIMIT ============
CREATE OR REPLACE FUNCTION public.venue_can_send_blast(_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.blasts
      WHERE venue_id = _venue_id
        AND status IN ('paid','sent')
        AND created_at > now() - interval '24 hours') < 2
    AND
    (SELECT count(*) FROM public.blasts
      WHERE venue_id = _venue_id
        AND status IN ('paid','sent')
        AND created_at > now() - interval '7 days') < 7
$$;

-- ============ CLEANUP ============
CREATE OR REPLACE FUNCTION public.cleanup_location_pings()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.user_location_pings WHERE seen_at < now() - interval '7 days';
$$;
