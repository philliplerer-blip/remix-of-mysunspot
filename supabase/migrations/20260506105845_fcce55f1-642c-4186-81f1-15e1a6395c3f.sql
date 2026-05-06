-- Venues table for curated outdoor venues
CREATE TABLE public.venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  lat           double precision,
  lng           double precision,
  neighborhood  text NOT NULL,
  venue_type    text[] NOT NULL,
  outdoor_type  text[] NOT NULL,
  confidence    text NOT NULL,
  sources       jsonb NOT NULL,
  note          text,
  needs_geocoding boolean NOT NULL DEFAULT false,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_unique_name_coords UNIQUE (name, lat, lng)
);

-- Indexes
CREATE INDEX idx_venues_neighborhood ON public.venues (neighborhood);
CREATE INDEX idx_venues_confidence   ON public.venues (confidence);
CREATE INDEX idx_venues_venue_type   ON public.venues USING GIN (venue_type);
CREATE INDEX idx_venues_outdoor_type ON public.venues USING GIN (outdoor_type);

-- Validation trigger (CHECK constraints can't be used due to immutability rules; trigger gives flexibility + clear errors)
CREATE OR REPLACE FUNCTION public.validate_venue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed_venue_types text[] := ARRAY['restaurant','bar','cafe','rooftop'];
  allowed_outdoor_types text[] := ARRAY['terrace','garden','courtyard','rooftop','sidewalk'];
  vt text;
  ot text;
BEGIN
  -- Normalize name: NFC + trim
  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    RAISE EXCEPTION 'venues.name cannot be empty' USING ERRCODE = '22023';
  END IF;
  NEW.name := btrim(normalize(NEW.name, NFC));

  -- Confidence
  IF NEW.confidence NOT IN ('verified','likely') THEN
    RAISE EXCEPTION 'venues.confidence must be verified or likely (got %)', NEW.confidence USING ERRCODE = '22023';
  END IF;

  -- venue_type / outdoor_type non-empty + allowed
  IF NEW.venue_type IS NULL OR array_length(NEW.venue_type, 1) IS NULL THEN
    RAISE EXCEPTION 'venues.venue_type cannot be empty' USING ERRCODE = '22023';
  END IF;
  FOREACH vt IN ARRAY NEW.venue_type LOOP
    IF NOT (vt = ANY (allowed_venue_types)) THEN
      RAISE EXCEPTION 'venues.venue_type contains invalid value: %', vt USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF NEW.outdoor_type IS NULL OR array_length(NEW.outdoor_type, 1) IS NULL THEN
    RAISE EXCEPTION 'venues.outdoor_type cannot be empty' USING ERRCODE = '22023';
  END IF;
  FOREACH ot IN ARRAY NEW.outdoor_type LOOP
    IF NOT (ot = ANY (allowed_outdoor_types)) THEN
      RAISE EXCEPTION 'venues.outdoor_type contains invalid value: %', ot USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Coordinate validation (when present)
  IF NEW.lat IS NULL AND NEW.lng IS NULL THEN
    NEW.needs_geocoding := true;
  ELSIF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RAISE EXCEPTION 'venues.lat and lng must both be set or both be null' USING ERRCODE = '22023';
  ELSE
    -- Lat/lng order safety
    IF NEW.lat < 55 OR NEW.lat > 56 OR NEW.lng < 12 OR NEW.lng > 13 THEN
      RAISE EXCEPTION 'venues coordinates outside CPH region (lat=%, lng=%) — possible lat/lng swap', NEW.lat, NEW.lng USING ERRCODE = '22023';
    END IF;
    -- Bounding box (Copenhagen + Frederiksberg)
    IF NEW.lat < 55.610 OR NEW.lat > 55.760 OR NEW.lng < 12.470 OR NEW.lng > 12.700 THEN
      RAISE EXCEPTION 'venues coordinates outside Copenhagen bounding box (lat=%, lng=%)', NEW.lat, NEW.lng USING ERRCODE = '22023';
    END IF;
    NEW.needs_geocoding := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_venue
BEFORE INSERT OR UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.validate_venue();

-- RLS: authenticated read only, no client writes
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues read authenticated"
ON public.venues
FOR SELECT
TO authenticated
USING (true);
