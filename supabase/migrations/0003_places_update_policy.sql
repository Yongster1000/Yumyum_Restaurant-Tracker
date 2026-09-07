-- `places` (see 0001_init.sql) originally had no update policy at all,
-- deliberately blocking client-side edits to shared/deduplicated data.
-- The app now opportunistically backfills Google-sourced fields
-- (google_photo_name, cost_bracket) on places that predate those columns
-- being fetched, whenever that place is looked up again -- allow that write
-- path the same way inserts on this table are already allowed.
create policy "Authenticated users can update places"
on public.places for update
to authenticated
using (true)
with check (true);
