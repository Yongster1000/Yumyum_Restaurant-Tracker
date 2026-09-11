-- Fixes accounts that can sign in (they have an auth.users row) but fail
-- every insert into public.entries with:
--   insert or update on table "entries" violates foreign key constraint
--   "entries_user_id_fkey"
-- because they have no matching public.users row. entries.user_id
-- references public.users(id), not auth.users(id) directly, so this trigger
-- is load-bearing: `on_auth_user_created` (0001_init.sql) is supposed to
-- mirror every new auth.users row into public.users at signup time. Since
-- this project isn't CLI-linked (no supabase/config.toml, no linked project
-- ref), migrations reach the live DB by being pasted into the SQL editor
-- ad-hoc rather than via `supabase db push` -- so it's entirely possible an
-- account was created before 0001 was applied there, or 0001 was applied
-- out of order/partially. Safe to run standalone and repeatedly:
--   1. Re-creates the function/trigger from scratch (create or replace /
--      drop-if-exists + create) so they're guaranteed correct on the live
--      DB regardless of what's already there.
--   2. Backfills any existing auth.users rows missing a public.users row,
--      using the exact same display_name fallback the trigger uses, so
--      backfilled rows look identical to ones the trigger would have created.

-- ============================================================================
-- 1. Re-assert handle_new_user() and its trigger
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. Backfill any auth.users rows missing a public.users row
-- ============================================================================

insert into public.users (id, display_name)
select
  au.id,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1))
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;
