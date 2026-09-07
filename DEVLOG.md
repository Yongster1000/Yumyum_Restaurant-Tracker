# Dev Log

Running log of work on the Yumyums app. Newest entries at the bottom of each
day's section. Open/unresolved issues are tracked at the top so they don't
get buried.

## Resolved issues

### Chip filter text clipped on Android (RESOLVED — fix #5 below)

**Symptom**: on the "My places" screen, the food-type filter chips below the
search bar (`mobile/src/app/(tabs)/index.tsx`) show text with the tops of
letters clipped off — visible on "Korean Restaurant" and "Restaurant", not
obviously on "All". Confirmed via screenshot on a physical/emulated Android
device. Not yet confirmed fixed on-device.

**Extra repro detail (2026-09-07)**: confirmed persistent, not a first-mount
thing — tabbing between "All" and other filters does not fix it. Whichever
filter is active is what matters, and "All" specifically breaks while every
other filter is fine. This ruled out attempt #2's mount-timing theory and
also weakens attempt #4's font-metrics theory below, since a font-metrics bug
would clip uniformly regardless of which filter is active — it wouldn't
correlate with one specific value of `activeFilter`.

**Attempts so far, in order:**

1. **Fixed height on the chip row** (`chipList: { height: 64 }`) — theory was
   that the horizontal `FlatList` wasn't auto-sizing its own height from
   content. Did not fix it, and likely made it worse (see #3) since 64 was a
   guessed value.
2. **Swapped `FlatList` → `ScrollView` for the chip row**, removed the fixed
   height, added `alignItems: 'center'` — theory was a first-mount
   measurement/virtualization glitch in `FlatList` (matched the observation
   that the row looked fine once you'd tapped any chip, i.e. after any
   re-render). Reported as still broken.
3. **Root-caused via an isolated repro**: built a temporary debug route
   (`mobile/src/app/debug-chips.tsx`, since removed) rendering the same chip
   row with no auth/data dependency, ran it under `expo start --web` +
   Playwright (headless Chromium), and inspected the actual computed layout.
   It rendered **perfectly on web** — no clipping at all. This ruled out the
   flex/layout theory entirely and pointed at something Android-specific.
4. **Applied a fix based on that finding**: `mobile/src/components/themed-text.tsx`
   now sets an explicit `lineHeight` (1.3× font size) on Android whenever the
   caller hasn't set one, on the theory that Android derives line height from
   the custom Google Fonts (Figtree/Caprasimo) TTFs' own internal metrics
   when none is specified, clipping ascenders — a well-known class of bug
   with custom fonts on Android specifically (doesn't reproduce on iOS/web).
   Supporting evidence: `includeFontPadding` (Android's own built-in guard
   against this) is untouched anywhere in the codebase, and `lineHeight` was
   set explicitly in exactly one place in the whole app before this fix.
   Superseded by attempt #5 below once the bug turned out to correlate with
   `activeFilter`'s value, which this fix doesn't explain — kept in place
   regardless since it's a real, separate latent issue worth having fixed.
5. **Found the actual variable that differs between "All" and other
   filters**: it's not the chip row itself, it's entry *count* — "All" is the
   only filter that always shows the maximum number of entries, since every
   other filter is necessarily a subset. That pointed at the entries
   `FlatList` directly below the chip row (`mobile/src/app/(tabs)/index.tsx`),
   which had **no `style` prop at all** — no `flex: 1`, nothing bounding its
   height, so instead of filling remaining space and scrolling internally it
   tries to size itself to fit *all* its content. Tried reproducing this on
   web too (same structure, 12 items vs. 2 items) — rendered fine either way,
   but that's expected either way: `react-native-web` doesn't share Android's
   native `ScrollView`/Yoga measurement code, so a bug specific to unbounded
   nested scrollables wouldn't be expected to show up in a browser regardless
   of whether it's real on-device. Added `style={{ flex: 1 }}` to that
   `FlatList` (`entriesList` style) so it's properly bounded instead of
   trying to size to full content — the reasoning is sound and this is an
   objectively-correct fix regardless (an unbounded ScrollView in a flex
   column is always wrong), but it is a genuinely different fix from anything
   tried before, since attempts #1-#4 all touched the chip row itself rather
   than the list below it.

**Status**: confirmed fixed on-device after fix #5 (giving the entries
`FlatList` `flex: 1`). Fix #4 (the Android `lineHeight` default in
`ThemedText`) was kept in too — unrelated to this specific bug, but a real
latent issue worth having fixed regardless.

## 2026-09-07

- Wired Google Places Autocomplete (New) into the add-entry flow
  (`mobile/src/lib/google-places.ts`, `mobile/src/components/entry-form.tsx`),
  with session-token grouping and search-before-create dedup against existing
  `places` rows by `google_place_id`.
- Full visual redesign of all screens from a Claude Design artifact: new
  design-token system (`mobile/src/constants/theme.ts`), custom
  Caprasimo/Figtree fonts, custom floating tab bar, shared component library
  (`Button`, `Card`, `Chip`, `Tag`, `SearchBar`, icons). Light-only, applied
  all at once per explicit decision.
- Added a swipeable multi-photo hero gallery and a full-screen pinch/pan/
  double-tap photo viewer (`mobile/src/components/photo-viewer.tsx`) on the
  Place Detail screen; fixed a missing edit-entry UI affordance.
- Added a restaurant photo, sourced from Google Places (`places.google_photo_name`,
  `getPlacePhotoUrl()`), shown as a static hero image on Place Detail —
  decoupled from user-submitted food photos, which now get their own
  horizontal row further down the page.
- Added cost bracket (`places.cost_bracket`), sourced from Google's
  `priceLevel` field, shown inline next to the address on Place Detail and as
  a small badge on the My Places list.
- Wired up food type tagging (`food_types`/`place_food_types`), sourced
  solely from Google's `primaryTypeDisplayName` — one tag per place, no
  user-entered/edited tags. Closed out a TODO that had been sitting unwired
  since the tables were first created.
- Added opportunistic backfill: when an entry is added against an
  already-existing `places` row (e.g. re-adding a place after deleting your
  entry for it), any missing Google-sourced fields (photo, cost bracket, food
  type) are now filled in from the fresh fetch rather than staying null
  forever. Needed a new RLS `UPDATE` policy on `places`
  (`supabase/migrations/0003_places_update_policy.sql`), since the table
  previously only had `INSERT`/`SELECT` policies.
- Added delete-entry support (edit screen → "Delete entry"), including
  cleanup of the entry's uploaded Storage photos. Deletes the user's
  `entries` row only, not the shared `places` row (RLS already denies
  client-side place deletes, by design — this is unsaving your own visit,
  not removing shared/deduplicated place data).
- Fixed a real bug found via this work: `food_types` upsert (`ON CONFLICT DO
  UPDATE`) was failing with an RLS error on every use of a food type *after*
  its first, because `food_types` only ever had an `INSERT` policy, never an
  `UPDATE` one. Fixed by switching to select-then-insert (mirroring the
  existing `places` dedup pattern) instead of upsert — needed no new RLS
  policy.
- Fixed error messages across `entry-form.tsx` being swallowed to
  `"[object Object]"` — Supabase's errors are plain objects, not real `Error`
  instances, so `error instanceof Error` was always false for them. Added a
  shared `getErrorMessage()` helper.
- Fixed delete navigation: deleting an entry used `router.back()`, which only
  popped the edit modal and landed on the (now stale) Place Detail screen.
  Switched to `router.dismissTo('/(tabs)')` to go straight back to My Places.
- Fixed a real gesture-handler bug in the photo viewer: the pinch/pan
  `GestureDetector` was claiming every single-finger drag even while
  unzoomed, silently blocking the FlatList's own swipe-to-page-between-photos
  gesture. Fixed by disabling the pan gesture entirely while not zoomed in.
- Added a full-screen "Uploading photos…"/"Saving…" overlay during entry
  save, since the whole operation (including photo upload) was already
  blocking before navigating away, just with no strong visual feedback.
- Swapped the My Places thumbnail priority to prefer the restaurant's Google
  photo over a user's food photo (previously the reverse), for consistency
  with the Place Detail hero.
- Chip filter row layout bug — see **Resolved issues** above. Root cause was
  an unbounded entries `FlatList` on the same screen, not the chip row
  itself.
