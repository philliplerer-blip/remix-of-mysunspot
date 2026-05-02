create table public.bars_directory (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  rating numeric(2,1),
  user_ratings_total integer,
  price_level integer,
  outdoor_seating boolean,
  outdoor_source text not null default 'none' check (outdoor_source in ('api','keyword','none')),
  types text[] default '{}',
  keywords_matched text[] default '{}',
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bars_directory_outdoor_idx on public.bars_directory (outdoor_seating);
create index bars_directory_loc_idx on public.bars_directory (lat, lng);

alter table public.bars_directory enable row level security;

create policy "bars directory readable by everyone"
  on public.bars_directory for select
  using (true);

create trigger bars_directory_set_updated_at
  before update on public.bars_directory
  for each row execute function public.set_updated_at();