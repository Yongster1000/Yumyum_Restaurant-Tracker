-- Add storage for Google's own Places photo resource name for each place, so
-- the restaurant "storefront" photo can be rendered without re-hitting the
-- Places API on every view. This stores the Places API (New) photo *resource
-- name* (e.g. "places/ChIJ.../photos/AeJ..."), never a rendered URL — the URL
-- is built at read time by appending the API key (see
-- mobile/src/lib/google-places.ts's getPlacePhotoUrl), so we never bake a URL
-- with an embedded key into a stored column.

alter table public.places
  add column google_photo_name text;
