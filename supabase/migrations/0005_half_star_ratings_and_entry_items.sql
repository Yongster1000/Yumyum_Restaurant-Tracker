-- Two changes, both needed for the half-star rating feature the client is
-- being built against:
--
-- 1. `entries.rating` moves from integer (1-5) to numeric(2,1) so it can
--    hold half-star values (0.5-5 in 0.5 steps, e.g. 3.5).
-- 2. New `entry_items` table: an optional list of individual dishes logged
--    against an entry (e.g. multiple things tried at a food court),
--    additive alongside the existing holistic rating/comment on `entries`.
--    Each dish can link zero or more photos from the entry's own uploaded
--    photo pool (`entries.photos`) -- `entry_items.photos` stores a subset
--    of those same URLs, same `text[]` pattern as `entries.photos` itself,
--    rather than a separate photos table or its own upload flow.

-- ============================================================================
-- 1. entries.rating -> numeric(2,1), half-star check constraint
-- ============================================================================

-- The existing `rating integer check (rating between 1 and 5)` in 0001_init.sql
-- was declared inline with no explicit name, so Postgres auto-named it via
-- its default `<table>_<column>_check` convention -- almost certainly
-- `entries_rating_check`, and no migration since 0001 has touched this
-- column or renamed it. Rather than hardcode that assumption, look it up
-- from pg_constraint and drop whatever is actually there, so this migration
-- is correct against the live schema even if that naming assumption is ever
-- wrong.
do $$
declare
  v_constraint_name text;
begin
  select con.conname
  into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'entries'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ~ '\mrating\M';

  if v_constraint_name is not null then
    execute format('alter table public.entries drop constraint %I', v_constraint_name);
  end if;
end;
$$;

alter table public.entries
  alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table public.entries
  add constraint entries_rating_check
  check (rating is null or (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)));

-- ============================================================================
-- 2. entry_items: optional per-dish list attached to an entry
-- ============================================================================

create table public.entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  name text not null,
  rating numeric(2, 1) check (rating is null or (rating between 0.5 and 5 and rating * 2 = floor(rating * 2))),
  note text,
  photos text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index entry_items_entry_id_idx on public.entry_items (entry_id);

alter table public.entry_items enable row level security;

-- entry_items: readable by any authenticated user, same shared-feed pattern
-- as `entries` itself. Writable only when the referenced entry is owned by
-- the caller -- mirrors `entries`' own `auth.uid() = user_id` checks, just
-- indirected through a lookup on the parent entry since entry_items has no
-- user_id column of its own.
create policy "Entry items are readable by authenticated users"
on public.entry_items for select
to authenticated
using (true);

create policy "Users can insert items on their own entries"
on public.entry_items for insert
to authenticated
with check (
  exists (
    select 1 from public.entries e
    where e.id = entry_id and e.user_id = auth.uid()
  )
);

create policy "Users can update items on their own entries"
on public.entry_items for update
to authenticated
using (
  exists (
    select 1 from public.entries e
    where e.id = entry_id and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.entries e
    where e.id = entry_id and e.user_id = auth.uid()
  )
);

create policy "Users can delete items on their own entries"
on public.entry_items for delete
to authenticated
using (
  exists (
    select 1 from public.entries e
    where e.id = entry_id and e.user_id = auth.uid()
  )
);
