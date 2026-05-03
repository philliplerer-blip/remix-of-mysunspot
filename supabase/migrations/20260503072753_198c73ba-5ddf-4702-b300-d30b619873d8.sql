ALTER TABLE public.bars_directory
  ADD COLUMN IF NOT EXISTS sun_timeline jsonb,
  ADD COLUMN IF NOT EXISTS timeline_date date,
  ADD COLUMN IF NOT EXISTS timeline_computed_at timestamptz;