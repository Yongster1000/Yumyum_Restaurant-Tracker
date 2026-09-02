-- Yumyums initial schema.
-- Run this in the Supabase SQL editor, or via `supabase db push` once the
-- project is linked (see mobile/README or repo README for setup).

-- ============================================================================
-- Tables
-- ============================================================================

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique,
  name text not null,
  address text not null,
  lat numeric not null,
  lng numeric not null,
  cost_bracket text,
  created_at timestamptz not null default now()
);

create table public.food_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.place_food_types (
  place_id uuid not null references public.places (id) on delete cascade,
  food_type_id uuid not null references public.food_types (id) on delete cascade,
  primary key (place_id, food_type_id)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  rating integer check (rating between 1 and 5),
  visited boolean not null default false,
  comment text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index entries_place_id_idx on public.entries (place_id);
create index place_food_types_food_type_id_idx on public.place_food_types (food_type_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Mirror new auth.users rows into public.users so `Entry.user_id` always has
-- somewhere to point. `display_name` comes from the `options.data.display_name`
-- passed to `supabase.auth.signUp` on the client (falls back to the email's
-- local part).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.users enable row level security;
alter table public.places enable row level security;
alter table public.food_types enable row level security;
alter table public.place_food_types enable row level security;
alter table public.entries enable row level security;

-- users: readable by any authenticated user (Discover shows display names),
-- writable only by the owning user.
create policy "Users are readable by authenticated users"
on public.users for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.users for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- places: shared, deduplicated data — any authenticated user can read or add,
-- nobody can update/delete via the client (no policy = denied by default).
create policy "Places are readable by authenticated users"
on public.places for select
to authenticated
using (true);

create policy "Authenticated users can add places"
on public.places for insert
to authenticated
with check (true);

-- food_types: same shared-data pattern as places.
create policy "Food types are readable by authenticated users"
on public.food_types for select
to authenticated
using (true);

create policy "Authenticated users can add food types"
on public.food_types for insert
to authenticated
with check (true);

-- place_food_types: readable by all, insertable by whoever is tagging a place.
create policy "Place food types are readable by authenticated users"
on public.place_food_types for select
to authenticated
using (true);

create policy "Authenticated users can tag places with food types"
on public.place_food_types for insert
to authenticated
with check (true);

-- entries: readable by all authenticated users (Discover), writable only by
-- the owning user.
create policy "Entries are readable by authenticated users"
on public.entries for select
to authenticated
using (true);

create policy "Users can insert their own entries"
on public.entries for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own entries"
on public.entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
on public.entries for delete
to authenticated
using (auth.uid() = user_id);

-- ============================================================================
-- Storage (entry photos)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', true)
on conflict (id) do nothing;

-- Uploaded paths are expected as `{user_id}/{entry_id}/{filename}` (see
-- mobile/src/components/entry-form.tsx), so folder segment 1 is the owner.
create policy "Entry photos are publicly readable"
on storage.objects for select
using (bucket_id = 'entry-photos');

create policy "Users can upload their own entry photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'entry-photos'
  and (storage.foldername(name)) [1] = auth.uid()::text
);

create policy "Users can update their own entry photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'entry-photos'
  and (storage.foldername(name)) [1] = auth.uid()::text
);

create policy "Users can delete their own entry photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'entry-photos'
  and (storage.foldername(name)) [1] = auth.uid()::text
);
