-- =========================================================
-- 1. Profiles: add immutable @handle
-- =========================================================
alter table public.profiles
  add column if not exists handle text unique;

-- Format check: 3–20 chars, lowercase letters/digits/underscore
alter table public.profiles
  drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');

-- Trigger: once handle is set, it cannot be changed
create or replace function public.enforce_handle_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.handle is not null and new.handle is distinct from old.handle then
    raise exception 'handle is immutable once set';
  end if;
  return new;
end $$;

drop trigger if exists profiles_handle_immutable on public.profiles;
create trigger profiles_handle_immutable
before update on public.profiles
for each row execute function public.enforce_handle_immutable();

-- Allow exact-match handle lookup by any authenticated user
-- (needed for friend-request-by-handle; only handle/display_name/avatar_url are useful columns)
drop policy if exists "profiles lookup by handle" on public.profiles;
create policy "profiles lookup by handle"
on public.profiles
for select
to authenticated
using (handle is not null);

-- =========================================================
-- 2. Friendships
-- =========================================================
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  -- requester: who sent the original request (used for accept/decline UX)
  requested_by uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_canonical_order check (user_a < user_b),
  constraint friendships_unique_pair unique (user_a, user_b)
);

create index friendships_user_a_idx on public.friendships(user_a);
create index friendships_user_b_idx on public.friendships(user_b);
create index friendships_status_idx on public.friendships(status);

alter table public.friendships enable row level security;

-- Participants can read their own rows
create policy "friendships read participants"
on public.friendships for select
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

-- Inserts go through send_friend_request() (security definer); block direct inserts
-- by requiring the actor to be a participant AND the requester. Blocked-by check is
-- enforced inside the function.
create policy "friendships insert participant"
on public.friendships for insert
to authenticated
with check (
  auth.uid() = requested_by
  and (auth.uid() = user_a or auth.uid() = user_b)
);

-- Updates: only participants
create policy "friendships update participants"
on public.friendships for update
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b)
with check (auth.uid() = user_a or auth.uid() = user_b);

-- Deletes: only participants
create policy "friendships delete participants"
on public.friendships for delete
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

-- Helper: are these two users accepted friends?
create or replace function public.are_friends(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (user_a = least(_a, _b) and user_b = greatest(_a, _b))
      )
  )
$$;

-- Send a friend request (canonical pair, blocked-check, dup-check)
create or replace function public.send_friend_request(_target uuid)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _existing public.friendships;
  _row public.friendships;
begin
  if _me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if _target is null or _target = _me then
    raise exception 'invalid target' using errcode = '22023';
  end if;

  _a := least(_me, _target);
  _b := greatest(_me, _target);

  select * into _existing from public.friendships
   where user_a = _a and user_b = _b;

  if found then
    if _existing.status = 'blocked' then
      raise exception 'blocked' using errcode = '42501';
    end if;
    if _existing.status = 'accepted' then
      return _existing;
    end if;
    -- pending: if the *other* user previously requested, treat this as accept
    if _existing.status = 'pending' and _existing.requested_by <> _me then
      update public.friendships
         set status = 'accepted', updated_at = now()
       where id = _existing.id
       returning * into _row;
      return _row;
    end if;
    return _existing;
  end if;

  insert into public.friendships (user_a, user_b, requested_by, status)
  values (_a, _b, _me, 'pending')
  returning * into _row;
  return _row;
end $$;

-- =========================================================
-- 3. Presence sessions
-- =========================================================
create table public.presence_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (length(activity) between 1 and 80),
  bar_id uuid references public.bars_directory(id) on delete set null,
  location_lat double precision,
  location_lng double precision,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint presence_expiry_window
    check (expires_at > started_at and expires_at <= started_at + interval '4 hours')
);

create index presence_user_idx on public.presence_sessions(user_id);
create index presence_active_idx on public.presence_sessions(expires_at);

alter table public.presence_sessions enable row level security;

-- Owner can read all their own sessions (incl. expired, for history)
create policy "presence read own"
on public.presence_sessions for select
to authenticated
using (auth.uid() = user_id);

-- Friends can read only ACTIVE sessions of accepted friends
create policy "presence read friends active"
on public.presence_sessions for select
to authenticated
using (
  expires_at > now()
  and public.are_friends(auth.uid(), user_id)
);

-- Insert: only as self
create policy "presence insert own"
on public.presence_sessions for insert
to authenticated
with check (auth.uid() = user_id);

-- Update: only own (e.g. extend or end early)
create policy "presence update own"
on public.presence_sessions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Delete: only own
create policy "presence delete own"
on public.presence_sessions for delete
to authenticated
using (auth.uid() = user_id);

-- View that strips location for expired rows (defensive layer for "active friends" query)
create or replace view public.active_presence_sessions
with (security_invoker = true)
as
select
  id, user_id, activity, bar_id,
  case when expires_at > now() then location_lat end as location_lat,
  case when expires_at > now() then location_lng end as location_lng,
  started_at, expires_at, created_at
from public.presence_sessions
where expires_at > now();

grant select on public.active_presence_sessions to authenticated;

-- Cleanup: delete sessions expired > 24h
create or replace function public.cleanup_expired_presence()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.presence_sessions
   where expires_at < now() - interval '24 hours';
$$;

-- Schedule cleanup hourly via pg_cron (safe to re-run)
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('cleanup_expired_presence_hourly');
exception when others then null;
end $$;
select cron.schedule(
  'cleanup_expired_presence_hourly',
  '15 * * * *',
  $$ select public.cleanup_expired_presence(); $$
);