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

## 2026-09-09

Ran a full architectural critique (backend + frontend, in parallel) since the
app has no custom backend — the Expo client talks directly to Supabase (RLS)
and directly to Google Places using a key embedded in the public client
bundle. Worked through the Google Places key exposure and the critique's
"should fix soon" items:

- **Google Places API key lockdown (Console-only, no code)**: narrowed the
  shared API key's API restrictions by unchecking legacy "Places API" (kept
  Places API (New) + both Maps SDKs, since the key is also reused for
  `GOOGLE_MAPS_IOS_API_KEY`/`GOOGLE_MAPS_ANDROID_API_KEY` — confirmed via
  `.env` all three env vars are currently the same key value, so a full
  Places-only restriction isn't possible without splitting the key first).
  Also set daily/per-100s quota caps on Places API (New) in Google Cloud
  Console. Deferred: splitting into a dedicated Places-only key (would allow
  full API restriction + app-identity headers) and adding
  `X-Android-Package`/`X-Android-Cert`/`X-Ios-Bundle-Identifier` headers to
  `google-places.ts` to enable Android/iOS app restriction on direct REST
  calls — both left for later since the app currently only calls Places API
  (New) from JS, not the Maps SDKs.
- **Fixed `places` RLS UPDATE policy being dangerously broad**
  (`supabase/migrations/0004_backfill_place_details_rpc.sql`): the
  `0003_places_update_policy.sql` policy (`using (true) with check (true)`)
  let any authenticated user overwrite *any* column on *any* place row, not
  just the two Google-sourced backfill columns it was written for (RLS has
  no column granularity). Replaced with a `SECURITY DEFINER` RPC,
  `backfill_place_details(p_place_id, p_google_photo_name, p_cost_bracket)`,
  scoped to exactly those two columns via `coalesce` (never overwrites an
  already-set value), and dropped the open policy so `places` has no
  general-purpose client-side UPDATE path left. Updated the one call site
  (`mobile/src/components/entry-form.tsx`) to call the RPC instead of
  `.from('places').update(...)`. Applied to the live Supabase project via
  the SQL Editor.
- **Fixed `auth-context.tsx` hanging forever on a failed session fetch**: the
  initial `supabase.auth.getSession()` call had no `.catch`, so a rejection
  (cold start with no connectivity, AsyncStorage read failure) left
  `isLoading` stuck `true` forever with no recovery. Added `.catch`/`.finally`
  — a failed fetch now falls back to a signed-out state, which the existing
  routing already sends to `/(auth)/sign-in`.
- **Fixed read screens swallowing errors as if data legitimately didn't
  exist**: `(tabs)/index.tsx`, `(tabs)/discover.tsx`, `place/[id].tsx`, and
  `entry/[id].tsx` all either ignored `.error` on Supabase queries or (in
  `entry/[id].tsx`'s case) used a bare `.then()` with no `.catch` at all — a
  real unhandled-promise-rejection bug on network failure. All four now have
  a distinct error state with a "Try again" retry button instead of falling
  through to the empty-state UI or hanging on "Loading…" forever.
- **Added sign-out**: there was no way to sign out anywhere in the app. Added
  a sign-out icon button (`LogOutIcon`, new in `icons.tsx`) to the "My
  Places" header, `Alert.alert` confirm → `supabase.auth.signOut()`; existing
  `(tabs)/_layout.tsx` redirect-on-null-session handles routing back to
  sign-in with no extra navigation code needed.
- **Fixed tab switches losing all screen state**: `(tabs)/_layout.tsx` used
  `<Slot/>` with each screen drawing its own `FloatingTabBar` overlay via
  `Link href`, so switching tabs unmounted/remounted each screen — search
  text, active filter, and scroll position all reset every time, and the
  loading skeleton re-flashed on every switch. Switched to `Tabs` from
  `expo-router/js-tabs` (the root `expo-router` export is deprecated in SDK
  57 in favor of this) with `FloatingTabBar` rewritten as a proper
  `tabBar` render-prop component instead of a per-screen overlay — same
  visual design, but both tab screens now stay mounted across switches.

Deferred from the critique (explicit decisions, not oversights): wiring the
`Database` type into the Supabase client (blocked on `supabase login`, which
needs an interactive browser flow — not done yet), and self-service cleanup
for junk `places`/`food_types` rows created by typos/wrong autocomplete picks
(product-design question about shared-row deletion semantics, not urgent at
this app's scale — a manual SQL delete works fine when it happens).

**Testing**: `tsc --noEmit` and `expo lint` both pass clean. Code-level review
of all 5 fixes above confirmed each is wired correctly (RPC call site matches
the migration's signature exactly, retry buttons call the right load
function, sign-out wiring matches the existing session-based redirect, tab
bar correctly rewritten as a `tabBar` render-prop). No bugs found.

Live/interactive testing (actually driving the app through sign-in, the
backfill-RPC save path, sign-out, and tab-state persistence) was attempted
but blocked on auth: the existing test account hits `email_not_confirmed`,
fresh sign-ups hit Supabase's project-wide email rate limit, and anonymous
sign-in is disabled on the project — no service-role key exists in the repo
to work around it. Needs either "Confirm email" temporarily disabled in
Supabase Dashboard → Authentication → Providers → Email, or a confirmed test
account, to close this out. **Not yet confirmed working live — see open
issue below.**

**Live testing (2026-09-09, follow-up)**: unblocked with a confirmed real
account and re-run end-to-end (not just statically) — all 4 flows **PASS**:

- Backfill RPC: added an entry for a place not yet in `places`, deleted it,
  re-added an entry for the same place (hits the "existing place" branch,
  calls `backfill_place_details`) — saved with no RLS/RPC error either time.
  Test entry cleaned up afterward; account's real 4 entries confirmed
  untouched throughout.
- Sign-out round-trip: confirm prompt → sign-out → sign-in screen → signed
  back in → real data intact.
- Tab-state persistence: search text survived a My Places → Discover → My
  Places round trip with no skeleton re-flash; active-tab highlighting and
  switching looked correct.
- Read-screen error states: forced offline, confirmed `(tabs)/index.tsx`'s
  error state renders once Supabase's internal retry/backoff exhausts
  (~15-20s, not instant — worth knowing for future manual testing), and that
  "Try again" recovers correctly once back online.

`tsc`/`lint` still clean after live testing. No bugs found in any of the 5
fixed items.

## Open issues

### `Alert.alert()` is a no-op on the web build (found 2026-09-09, pre-existing, not caused by this batch)

`react-native-web` 0.21.2's `Alert.alert()` is a stub (`static alert() {}`) —
confirmed via `node_modules/react-native-web/dist/{cjs/,}exports/Alert/index.js`.
Since `app.config.ts` has `web: { output: 'single' }` (web is a real supported
target, not incidental), every `Alert.alert` call in the app — sign-out
confirm, delete-entry confirm, and error alerts like "Could not save entry"
in `entry-form.tsx` — silently does nothing on web specifically: the dialog
never appears and the user gets no feedback at all. Native iOS/Android builds
are unaffected (RN's real `Alert` works there). Not fixed yet — found
incidentally while live-testing this batch (testing agent worked around it
with a temporary, fully-reverted `window.confirm`/`window.alert` patch to
`node_modules` just to drive the web test session). Needs a real fix if the
web target is meant to be used seriously: either a small cross-platform
confirm/alert wrapper, or accepting web as "not fully supported" if it's only
ever used for local dev.

### More web-only bugs found while testing the dishes feature (2026-09-10, pre-existing, not caused by this batch)

Found incidentally during live testing (web-based, since that's the only
environment available for automated testing here) — none of these affect
real iOS/Android builds, which use native modules:

- **Photo upload throws on web**: `entry-form.tsx`'s `uploadPhotos` calls
  `new File(uri).arrayBuffer()` from `expo-file-system`; the web shim's
  `File` is a stub with no `arrayBuffer()` method, so any save including a
  newly-picked local photo throws on web. Silent to the user because of the
  `Alert.alert` no-op bug above (the error alert that would explain this
  never appears).
- **Web "Add photo" button doesn't open a file picker for real users
  either**: `expo-image-picker`'s web implementation dispatches a synthetic
  `MouseEvent('click')` on its hidden file input instead of calling
  `input.click()` directly — browsers block the native file-chooser dialog
  for untrusted synthetic clicks, so tapping "Add" does nothing on web.

## 2026-09-10 (continued) — Half-star ratings + dish list feature

Added a way to log individual dishes within a visit (e.g. a food-court run
with several things tried), additive alongside the existing holistic
rating/comment, plus switched ratings to 0.5 increments. Design came from a
Claude Design canvas continuation (artboards "Dishes / Form empty/filled",
"Place detail", "Compact cards — the hint").

- **Schema** (`supabase/migrations/0005_half_star_ratings_and_entry_items.sql`):
  `entries.rating` moved from `integer (1-5)` to `numeric(2,1)` with a check
  constraint enforcing 0.5-5 in 0.5 steps (the migration looks up the old
  constraint's actual name via `pg_constraint` rather than assuming it, so
  it's correct regardless of Postgres's auto-naming). New `entry_items`
  table (`entry_id`, `name`, `rating` — same half-star rule, `note`,
  `photos text[]`, `position` for stable ordering since a bulk insert can't
  rely on `created_at`), RLS mirroring `entries`' owner-only-write pattern
  via a subquery on the parent entry. Applied to the live project via the
  SQL editor.
- **Half-star rating UI**: new shared `mobile/src/components/star-rating.tsx`
  — tapping the left half of a star sets X.5, the right half sets X.0. Used
  for the entry's own rating (editable), per-dish rating (editable, smaller),
  and Place Detail's review display (read-only). `StarIcon` in `icons.tsx`
  gained a `fraction` prop for the half-fill rendering (SVG `ClipPath`).
- **Dishes section** (`entry-form.tsx`): dashed "Log dishes you tried"
  button when empty, otherwise a card per dish (name/rating/note/remove),
  "Another dish" pill to add more. Save strategy: delete all the entry's
  `entry_items` and bulk-reinsert the current list (simple, not diffed —
  fine at this scale), skipped entirely when there are and were no dishes.
- **Per-dish photo linking**: dishes don't get their own upload flow — they
  link to a subset of the entry's own already-uploaded photos (shared pool,
  same as `entries.photos`). Each dish gets a thumbnail row + a "+" tile
  opening a modal to toggle which of the entry's photos are linked to it.
  Handles the tricky part: a dish may link a photo by its local `file://`
  URI before it's uploaded — `handleSave` builds a URI-to-uploaded-URL map
  after `uploadPhotos()` resolves and remaps every dish's `photos` through
  it (dropping stale/unresolvable links) before the `entry_items` write.
- **Display**: Place Detail shows a "🍴 N dishes" header + each dish's
  name/note/rating/photos (tap to view fullscreen via the existing
  `PhotoViewer`) under any review that has them. My Places / Discover cards
  get a minimal utensils-icon + count hint next to existing tags — only
  when an entry has dishes, no added row height.

**Testing**: live-tested end-to-end against the real account (half-star
tapping → save → persists correctly everywhere it's displayed; added 2
dishes with ratings/notes/a linked photo → saved → reopened for edit,
identical → Place Detail renders correctly; removing a photo from the main
pool correctly unlinked it from the dish; compact-card hint appears only on
entries with dishes). Test entry cleaned up afterward (deleted via direct
API call since the UI's delete confirm relies on the web-only-broken
`Alert.alert`, not a real gap in the native app); account's original 7
entries confirmed unchanged. `tsc`/`lint` clean. One caveat: the live
save→display round-trip for *photo* linking specifically (as opposed to the
linking UI itself, which was directly verified interactively) couldn't be
fully exercised because of the pre-existing web-only photo-upload bug above
— worth a quick manual check on a real device given the chance, though the
remapping code was also read and reasoned through as correct.

## 2026-09-09 (continued) — EAS Build setup (Android)

Set up standalone Android builds via EAS so testing no longer requires
running through Expo dev tooling every time. Android-only for now (iOS real-
device installs need a paid Apple Developer account, deferred).

- Created `mobile/eas.json` with a `preview` build profile (`distribution:
  internal`, `android.buildType: apk` — a directly-sideloadable APK, no Play
  Store needed) and `cli.appVersionSource: remote` so EAS auto-increments the
  Android version code instead of it being hand-maintained.
- Linked the repo to a new EAS project (`@yongster1000/yumyums`,
  `owner`/`extra.eas.projectId` added to `app.config.ts` — had to be added
  manually since `eas init`/`eas update:configure` can't auto-write a dynamic
  `app.config.ts`, only static `app.json`).
- Registered the app's 4 build-time env vars (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`,
  `GOOGLE_MAPS_ANDROID_API_KEY`) as EAS Environment Variables (`preview` +
  `production`), since cloud builds don't see the local `.env` file — this
  was pulled straight from the existing `.env` values, nothing new generated.
- Installed and configured `expo-updates` (`runtimeVersion.policy:
  'appVersion'`, `updates.url` pointing at the EAS project) so future JS/
  asset-only changes can ship via `eas update --channel preview` without a
  full rebuild+reinstall — this is the actual fix for "don't want to go
  through Expo every time" going forward; a fresh `eas build` is only needed
  again when something native changes.
- First `eas build --profile preview --platform android` succeeded —
  EAS-managed keystore (auto-generated, not hand-rolled), `versionCode`
  initialized to 1 and now tracked remotely (auto-increments on future
  builds). Install link:
  https://expo.dev/accounts/yongster1000/projects/yumyums/builds/af4f39f4-07da-463b-9b22-fc90c2af2642
  Also created the `preview` update channel/branch as a side effect of the
  build, so `eas update --branch preview` is ready to use for future
  JS/asset-only changes without needing a new build.

### White-screen crash on any entry save, on-device (2026-09-10)

**Symptom**: on the real Android build (not caught by any of our earlier web-
based testing), saving an entry — either adding a new place or editing an
existing one — reliably produced a permanent blank white screen requiring a
force-close. Data was actually saved correctly in both cases (confirmed via
My Places); the crash happened purely in post-save navigation/rendering.

**Diagnosis process**: added a global `ErrorBoundary`
(`mobile/src/components/error-boundary.tsx`, wired into `app/_layout.tsx`)
and shipped it via `eas update` to see the real error instead of a blank
screen — it never fired, which combined with confirming (via a throwaway
visible-marker OTA update) that update delivery itself was working, was the
key signal that this wasn't a catchable JS error at all. That ruled out a
render-logic bug and pointed at a native-layer crash, which needed a real
device log to diagnose. Set up `adb` (Android platform-tools, not previously
installed on this machine) and captured `adb logcat` while reproducing the
crash live over USB. Found the actual cause:
```
E SurfaceMountingManager: java.lang.IllegalStateException: addViewAt: cannot
  insert view [544] into parent [548]: View already has a parent: [546]
  Parent: ReactViewGroup View: SvgView
E MountItemDispatcher: Caused by: ... The specified child already has a
  parent. You must call removeView() on the child's parent first.
E FabricUIManager: Exception thrown when executing UIFrameGuarded
```
A Fabric (React Native new architecture) native crash: an `SvgView` was being
moved between two native view parents within a single mount batch, which
Fabric can't do safely.

**First hypothesis (wrong, but left in as harmless defense-in-depth)**:
theorized the destination screen's `useFocusEffect` refetch was landing
mid-transition and racing `react-native-screens`. Deferred it with
`InteractionManager.runAfterInteractions(...)` in all four screens that use
this pattern (`(tabs)/index.tsx`, `(tabs)/discover.tsx`, `place/[id].tsx`,
`entry/[id].tsx`). Shipped via `eas update`, retested on-device — **did not
fix it**, same crash.

**Actual root cause**, found from a second on-device `adb logcat` capture:
the Fabric view-tree dump at the moment of the crash showed the SvgView
belonged to `entry-form.tsx`'s own header — specifically the close (X)
button's icon inside its `CircleButton`. The mechanism: `handleSave` calls
`router.back()` on success, but control then fell through to a `finally`
block that unconditionally called `setIsSaving(false)` — re-rendering the
form (and flipping the header button's `disabled` prop) *while the modal was
still mid-exit-transition*, racing Fabric's teardown of that screen. The
adjacent `handleDelete` function already avoided this exact pitfall (it only
resets its loading flag inside `catch`, never after a successful
navigate-away) — that asymmetry with `handleSave`'s `finally` was the actual
tell.

**Fix**: removed the `finally` block in `handleSave`; `setIsSaving(false)`
now only runs in the `catch` path (where the screen stays mounted), matching
`handleDelete`'s existing pattern. No state update happens after a
successful `router.back()` anymore. Shipped via `eas update`. **Confirmed
fixed on-device** — both add and edit save flows tested working.

Diagnosis tooling note: this whole investigation needed a real device crash
log — the JS-level `ErrorBoundary` added first never fired (correctly, since
this was never a JS exception), which was itself the signal to stop
theorizing about JS and go get `adb logcat`. Android platform-tools (`adb`)
weren't installed on this machine; downloaded platform-tools and captured
logs over USB from the user's phone directly.

## 2026-09-11 — Sign-up flow, email confirmation, Discover cleanup, layout fixes

### Sign-up left the user stranded with no feedback

**Symptom**: creating an account left the user stuck on the create-account
screen — no error, no navigation, nothing.

**Root cause**: `(auth)/sign-up.tsx`'s `handleSignUp` cleared `isSubmitting`
on a successful `signUp()` call and did nothing else, relying entirely on
`onAuthStateChange` (`lib/auth-context.tsx`) firing a session so
`(auth)/_layout.tsx`'s `<Redirect>` would kick in. That never happens when
the Supabase project requires email confirmation (this one does — see below):
`signUp()` succeeds with `data.session` still `null`.

**Fix**: `handleSignUp` now explicitly `router.replace('/(auth)/sign-in')` on
success instead of waiting on a session that may never arrive, and shows a
toast ("Account created — sign in to get started"). There was no toast/
snackbar anywhere in the codebase, so added a minimal one from scratch
(`mobile/src/components/toast.tsx` — `ToastProvider`/`useToast()`, animated
with `react-native-reanimated`, mounted in `app/_layout.tsx` so it survives
the sign-up → sign-in navigation).

### Email confirmation link redirected to `localhost:3000` and did nothing

**Symptom**: tapping "confirm your email" sent the user to `http://localhost:3000`
— dead, since this is a mobile app with nothing running there.

**Root cause**: Supabase's default Site URL is `localhost:3000`, and
`signUp()` never overrode it with an app-specific redirect, so every
confirmation email fell back to that default.

**Fix**: added `flowType: 'pkce'` to the Supabase client (`lib/supabase.ts`)
so confirmation links carry a `?code=` query param instead of a URL fragment
(more reliable through native deep-link handling); `sign-up.tsx` now passes
`emailRedirectTo: Linking.createURL('auth-confirm')`, pointing the link at
the app's `yumyums://` scheme. Added a new top-level screen
(`app/auth-confirm.tsx`) that reads the `code` (or `error`/`error_description`)
from the incoming link, calls `supabase.auth.exchangeCodeForSession(code)`,
and routes into the app (or back to sign-in with a toast on failure).
Required a matching dashboard change this session couldn't make directly (no
Supabase CLI link/access token): added `yumyums://auth-confirm`,
`yumyums://*`, and `exp://*/--/auth-confirm` (for Expo Go) to Authentication
→ URL Configuration → Redirect URLs. **Caveat**: the deep-link round-trip
itself (email → tap link → lands on `auth-confirm` → session established)
hasn't been live-confirmed end-to-end yet, only reasoned through and
typechecked — worth an explicit test.

### `entries` FK violation on every "add to own list" — missing `public.users` rows

**Symptom**: Discover's "+" button failed with `insert or update on table
"entries" violates foreign key constraint "entries_user_id_fkey"`.

**Diagnosis**: `entries.user_id` references `public.users(id)`, which is
supposed to be populated by the `handle_new_user()` trigger
(`on_auth_user_created`, from `0001_init.sql`) on every `auth.users` insert.
Diagnostic queries against the live DB confirmed the trigger **did not
exist there at all** (`select tgname from pg_trigger where tgname =
'on_auth_user_created'` returned 0 rows) — this project isn't CLI-linked, so
migrations reach production by hand via the SQL editor, and `0001_init.sql`'s
trigger apparently never actually got applied, even though the table
migrations from it clearly had been.

**Fix**: `supabase/migrations/0006_backfill_missing_public_users.sql` —
re-creates the trigger/function idempotently (`create or replace`,
`drop trigger if exists` + recreate, `on conflict (id) do nothing` on the
insert) and backfills any existing `auth.users` row missing its
`public.users` counterpart. Applied directly via the SQL editor and
confirmed: re-run of the trigger-existence query now returns
`on_auth_user_created` / `tgenabled = 'O'`. New signups get their
`public.users` row automatically from here on.

### Discover: removed the non-functional filter chips

The per-user filter chip row below Discover's search bar wasn't doing
anything useful for its intended purpose; removed it entirely per request
(`(tabs)/discover.tsx`) along with the now-dead `activeUserId`/`userFilters`
state and filtering logic. Search-by-name/user still works.

### My Places: "Want to try" tag overlapped the cost-bracket badge

**Root cause**: the cost-bracket badge (`priceBadge`, `(tabs)/index.tsx`) was
`position: absolute` in the card's top-right corner, independent of the
row's flex layout, while the rating badge / "Want to try" tag sits vertically
centered in the same row — on shorter cards these collided.

**Fix**: replaced the absolute positioning with a real flex column
(`rightColumn`): the price badge and the rating/"Want to try" tag are now
both normal-flow children stacked with a small gap, so they can never
overlap regardless of card height.

### Android's system nav bar covered the bottom-most entry

**Root cause**: both the floating tab bar's position (`bottom: 38`,
`floating-tab-bar.tsx`) and the entries lists' bottom padding
(`BottomTabInset = 120`, `constants/theme.ts`) were flat pixel constants
tuned for a zero-inset device, with no awareness of the device's actual
safe-area bottom inset — which varies with Android's 3-button vs. gesture
nav.

**Fix**: both now add `insets.bottom` (from `useSafeAreaInsets()`) on top of
the existing constants — purely additive, so zero-inset devices look
unchanged and devices with a real system nav bar get proper clearance.
Applied in `floating-tab-bar.tsx` and both entries lists
(`(tabs)/index.tsx`, `(tabs)/discover.tsx`).

**Testing**: `tsc --noEmit` and `expo lint` clean after every fix above. Not
live-tested on-device this session beyond typecheck/lint — shipped via
`eas update --branch preview` (update group `254d6724-8d55-4444-ab4b-6e504829fdb8`)
so on-device testing happens against the live preview build. `supabase/
migrations/0004`-`0006` and several `mobile/` files are still uncommitted in
git as of this entry (session's work applied directly to the live DB/EAS
branch ahead of a commit) — worth committing once confirmed good on-device.
