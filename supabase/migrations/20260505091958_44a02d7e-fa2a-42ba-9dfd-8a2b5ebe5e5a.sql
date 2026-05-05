-- Lock down SECURITY DEFINER functions
revoke all on function public.cleanup_expired_presence() from public, anon, authenticated;
revoke all on function public.enforce_handle_immutable() from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon;

-- send_friend_request is intentionally callable by signed-in users
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Move pg_cron out of public schema
create schema if not exists extensions;
-- pg_cron must live in its own schema; recreate there if currently in public
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_cron' and n.nspname = 'public'
  ) then
    alter extension pg_cron set schema extensions;
  end if;
end $$;