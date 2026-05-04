
CREATE TABLE public.places_fetch_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_key text NOT NULL UNIQUE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.places_fetch_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "places cache readable by everyone"
ON public.places_fetch_cache FOR SELECT
USING (true);

CREATE INDEX idx_places_fetch_cache_tile_key ON public.places_fetch_cache(tile_key);
