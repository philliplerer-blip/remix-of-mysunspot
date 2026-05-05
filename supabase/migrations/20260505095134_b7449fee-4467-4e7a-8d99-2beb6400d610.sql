-- ============================================================
-- BeerWithMe-style profile + visibility gating
-- ============================================================

-- 1) Visibility enum
do $$ begin
  create type public.profile_visibility as enum ('friends_only', 'private');
exception when duplicate_object then null; end $$;

-- 2) Profile columns
alter table public.profiles
  add column if not exists status_emoji text,
  add column if not exists status_text  text,
  add column if not exists status_updated_at timestamptz,
  add column if not exists visibility public.profile_visibility not null default 'friends_only';

-- 3) Allowlist of status emoji (constant in code AND DB)
-- 🌿 represents hops (no dedicated hops emoji exists in Unicode).
-- Do not extend this list without a deliberate product decision.
create or replace function public.is_allowed_status_emoji(_e text)
returns boolean
language sql
immutable
as $$
  select _e is null or _e = any (array['🍎','🍊','🍌','🍇','🍓','🍉','🍑','🍒','🍍','🌿']::text[])
$$;

-- 4) Validation trigger (CHECK can't call non-immutable funcs reliably; use trigger)
create or replace function public.validate_profile_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status_emoji is not null and not public.is_allowed_status_emoji(new.status_emoji) then
    raise exception 'status_emoji not in allowlist' using errcode = '22023';
  end if;
  if new.status_text is not null then
    -- Strip ASCII control chars (incl. NULs, newlines beyond LF? keep LF? we strip all <0x20 except plain space).
    new.status_text := regexp_replace(new.status_text, '[\x00-\x1F\x7F]', '', 'g');
    new.status_text := btrim(new.status_text);
    if length(new.status_text) > 60 then
      raise exception 'status_text exceeds 60 chars' using errcode = '22023';
    end if;
    if new.status_text = '' then new.status_text := null; end if;
  end if;
  if new.display_name is not null then
    new.display_name := btrim(regexp_replace(new.display_name, '[\x00-\x1F\x7F]', '', 'g'));
    if length(new.display_name) > 40 then
      raise exception 'display_name exceeds 40 chars' using errcode = '22023';
    end if;
    if length(new.display_name) < 1 then
      raise exception 'display_name cannot be empty' using errcode = '22023';
    end if;
  end if;
  -- Bump status_updated_at only when emoji or text actually changes
  if (tg_op = 'INSERT')
     or (new.status_emoji is distinct from old.status_emoji)
     or (new.status_text  is distinct from old.status_text)
  then
    new.status_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_profile_status on public.profiles;
create trigger trg_validate_profile_status
before insert or update on public.profiles
for each row execute function public.validate_profile_status();

-- 5) Reattach the existing handle-immutable trigger if it was created without explicit name
drop trigger if exists trg_enforce_handle_immutable on public.profiles;
create trigger trg_enforce_handle_immutable
before update on public.profiles
for each row execute function public.enforce_handle_immutable();

-- 6) Visibility helper (security-critical)
create or replace function public.can_view_profile(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _viewer is null or _target is null then false
    when _viewer = _target then true
    else (
      -- mutual friendship, accepted, neither blocked, target not private
      exists (
        select 1
        from public.friendships f
        join public.profiles p on p.id = _target
        where f.status = 'accepted'
          and f.user_a = least(_viewer, _target)
          and f.user_b = greatest(_viewer, _target)
          and p.visibility <> 'private'
      )
      and not exists (
        select 1 from public.friendships
        where status = 'blocked'
          and user_a = least(_viewer, _target)
          and user_b = greatest(_viewer, _target)
      )
    )
  end
$$;

-- 7) Gated profile reader. Returns 0 rows for non-visible (default-deny → caller maps to 404).
create or replace function public.get_profile_for_viewer(_target_handle text)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  status_emoji text,
  status_text text,
  status_updated_at timestamptz,
  visibility public.profile_visibility
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _viewer uuid := auth.uid();
  _target_id uuid;
begin
  if _viewer is null then return; end if;
  -- Constant work whether the handle exists or not (timing parity).
  select p.id into _target_id from public.profiles p where p.handle = _target_handle;
  if _target_id is null then
    -- Do a dummy visibility call so timing is comparable.
    perform public.can_view_profile(_viewer, _viewer);
    return;
  end if;
  if not public.can_view_profile(_viewer, _target_id) then
    return;
  end if;
  return query
    select p.id, p.handle, p.display_name, p.avatar_url,
           p.status_emoji, p.status_text, p.status_updated_at, p.visibility
    from public.profiles p where p.id = _target_id;
end $$;

-- 8) Friend-summary listing (lean fields only)
create or replace function public.list_visible_friend_summaries()
returns table (
  user_id uuid,
  handle text,
  display_name text,
  status_emoji text,
  friendship_id uuid,
  status public.friendship_status,
  requested_by uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id)
  select
    case when f.user_a = (select id from me) then f.user_b else f.user_a end as user_id,
    p.handle,
    p.display_name,
    case when public.can_view_profile((select id from me),
           case when f.user_a = (select id from me) then f.user_b else f.user_a end)
      then p.status_emoji else null end as status_emoji,
    f.id as friendship_id,
    f.status,
    f.requested_by
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = (select id from me) then f.user_b else f.user_a end
  where (select id from me) is not null
    and (f.user_a = (select id from me) or f.user_b = (select id from me))
    and f.status in ('pending','accepted')
$$;

-- 9) Tighten profile RLS: drop the broad 'lookup by handle' policy.
-- All non-self reads must go through get_profile_for_viewer / list_visible_friend_summaries.
drop policy if exists "profiles lookup by handle" on public.profiles;

-- Ensure self-select / self-insert / self-update remain. (They already exist.)

-- 10) Lock down direct execution of the security-definer helpers so only auth'd users use them.
revoke all on function public.get_profile_for_viewer(text) from public, anon;
grant execute on function public.get_profile_for_viewer(text) to authenticated;

revoke all on function public.list_visible_friend_summaries() from public, anon;
grant execute on function public.list_visible_friend_summaries() to authenticated;

revoke all on function public.can_view_profile(uuid, uuid) from public, anon;
grant execute on function public.can_view_profile(uuid, uuid) to authenticated;

revoke all on function public.is_allowed_status_emoji(text) from public, anon;
grant execute on function public.is_allowed_status_emoji(text) to authenticated;

-- 11) Index for handle lookup speed (already unique? add if missing)
create unique index if not exists profiles_handle_unique on public.profiles (handle) where handle is not null;