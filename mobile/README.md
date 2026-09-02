# Yumyums (mobile)

React Native / Expo app for tracking restaurants. See [`../yumyums_project_brief.md`](../yumyums_project_brief.md)
for the product spec and data model this scaffold implements.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase and Google API
   keys (see [`../README.md`](../README.md) for where to get these):

   ```bash
   cp .env.example .env
   ```

3. Apply the database schema — run [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
   against your Supabase project (paste it into the SQL editor in the
   dashboard, or `supabase db push` if you're using the Supabase CLI).

4. Start the app:

   ```bash
   npx expo start
   ```

   Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a
   simulator/emulator.

## Project layout

```
src/
  app/                  Expo Router file-based routes
    (auth)/             sign-in, sign-up — shown when there's no session
    (tabs)/             Own + Discover tabs — shown once signed in
    place/[id].tsx       Place detail (shared info + every user's entry)
    entry/new.tsx        Add entry
    entry/[id].tsx       Edit entry
  components/           Shared UI (themed-text, themed-view, entry-form, ...)
  lib/                  supabase client, auth context
  types/                database.ts hand-mirrors the Postgres schema
```

## What's scaffolded vs. still to build

Done: navigation skeleton, Supabase auth (email/password) wired to real
sign-in/sign-up, Own/Discover/Place-detail screens reading and writing real
`entries`/`places` rows, photo upload to Supabase Storage.

Still open (see `TODO`s in `src/components/entry-form.tsx` and the brief's
"Open decisions" section):

- Google Places autocomplete + fuzzy-match-existing-place search-before-create
  (the add-entry form currently takes a plain-text name/address and always
  creates a new `places` row).
- Food type multi-select chips (add/attach `food_types` via `place_food_types`).
- Map display on the place detail screen (`react-native-maps` is installed
  but not wired up yet).
- Google/Apple OAuth sign-in (email/password is wired up; brief left this open).
