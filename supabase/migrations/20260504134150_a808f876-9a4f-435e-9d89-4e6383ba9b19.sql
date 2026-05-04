ALTER TABLE public.bars_directory
  ADD COLUMN IF NOT EXISTS orientation_deg double precision,
  ADD COLUMN IF NOT EXISTS orientation_confidence double precision,
  ADD COLUMN IF NOT EXISTS orientation_method text,
  ADD COLUMN IF NOT EXISTS sun_score_timeline jsonb;