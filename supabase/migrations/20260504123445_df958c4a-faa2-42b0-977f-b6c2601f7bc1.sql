
CREATE TABLE public.overpass_buildings_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_key text NOT NULL UNIQUE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL,
  buildings jsonb NOT NULL,
  buildings_hash text NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_overpass_cache_tile_key ON public.overpass_buildings_cache(tile_key);
CREATE INDEX idx_overpass_cache_expires_at ON public.overpass_buildings_cache(expires_at);

ALTER TABLE public.overpass_buildings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overpass cache readable by everyone"
ON public.overpass_buildings_cache FOR SELECT
USING (true);

CREATE TRIGGER set_overpass_cache_updated_at
BEFORE UPDATE ON public.overpass_buildings_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bars_directory
ADD COLUMN IF NOT EXISTS timeline_inputs_hash text;
