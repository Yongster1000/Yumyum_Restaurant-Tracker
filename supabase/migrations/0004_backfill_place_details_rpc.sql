-- 0003 gave `places` a blanket `using (true) with check (true)` UPDATE
-- policy so the client could opportunistically backfill Google-sourced
-- fields (google_photo_name, cost_bracket) on existing rows. RLS has no
-- column granularity, so that policy actually let any authenticated user
-- overwrite ANY column on ANY place row (name, address, lat, lng,
-- google_place_id included) -- a client bug or stray query could corrupt a
-- place every other user's entries point to, with no audit trail.
--
-- Replace it with a SECURITY DEFINER RPC scoped to exactly the two backfill
-- columns, and drop the open policy so `places` has no general-purpose
-- client-side UPDATE path left at all.

drop policy "Authenticated users can update places" on public.places;

create or replace function public.backfill_place_details(
  p_place_id uuid,
  p_google_photo_name text default null,
  p_cost_bracket text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.places
  set
    google_photo_name = coalesce(places.google_photo_name, p_google_photo_name),
    cost_bracket = coalesce(places.cost_bracket, p_cost_bracket)
  where id = p_place_id;
end;
$$;

grant execute on function public.backfill_place_details(uuid, text, text) to authenticated;
