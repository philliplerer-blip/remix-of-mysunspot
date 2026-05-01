-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- Favorite bars (predefined bar id from src/lib/bars.ts)
create table public.favorite_bars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bar_id integer not null,
  bar_name text not null,
  lat double precision not null,
  lng double precision not null,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, bar_id)
);
alter table public.favorite_bars enable row level security;
create policy "fav bars select own" on public.favorite_bars for select using (auth.uid() = user_id);
create policy "fav bars insert own" on public.favorite_bars for insert with check (auth.uid() = user_id);
create policy "fav bars update own" on public.favorite_bars for update using (auth.uid() = user_id);
create policy "fav bars delete own" on public.favorite_bars for delete using (auth.uid() = user_id);

-- Custom spots
create table public.custom_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  note text not null default '',
  icon text not null default 'other',
  lat double precision not null,
  lng double precision not null,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.custom_spots enable row level security;
create policy "spots select own" on public.custom_spots for select using (auth.uid() = user_id);
create policy "spots insert own" on public.custom_spots for insert with check (auth.uid() = user_id);
create policy "spots update own" on public.custom_spots for update using (auth.uid() = user_id);
create policy "spots delete own" on public.custom_spots for delete using (auth.uid() = user_id);

-- Notification settings (per user)
create table public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  threshold_pct integer not null default 70,
  cooldown_minutes integer not null default 180,
  quiet_start_hour integer not null default 22,
  quiet_end_hour integer not null default 8,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
create policy "ns select own" on public.notification_settings for select using (auth.uid() = user_id);
create policy "ns insert own" on public.notification_settings for insert with check (auth.uid() = user_id);
create policy "ns update own" on public.notification_settings for update using (auth.uid() = user_id);

-- Sun alerts log (one row per notification we've sent)
create table public.sun_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('bar','spot')),
  target_ref text not null,
  target_name text not null,
  sun_pct integer not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.sun_alerts enable row level security;
create policy "alerts select own" on public.sun_alerts for select using (auth.uid() = user_id);
create policy "alerts update own" on public.sun_alerts for update using (auth.uid() = user_id);
create index sun_alerts_user_sent_idx on public.sun_alerts (user_id, sent_at desc);
create index sun_alerts_dedup_idx on public.sun_alerts (user_id, target_kind, target_ref, sent_at desc);

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger spots_updated before update on public.custom_spots for each row execute function public.set_updated_at();
create trigger ns_updated before update on public.notification_settings for each row execute function public.set_updated_at();

-- Auto-create profile + default notification settings on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.notification_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enable pg_cron + pg_net for scheduled edge function calls
create extension if not exists pg_cron;
create extension if not exists pg_net;