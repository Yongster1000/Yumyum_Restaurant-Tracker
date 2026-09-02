# Yumyums

A mobile app for tracking restaurants and places to eat. See
[`yumyums_project_brief.md`](yumyums_project_brief.md) for the full product
spec, data model, and open decisions.

## Repo layout

```
mobile/               Expo (React Native) app — see mobile/README.md to run it
supabase/migrations/  Postgres schema + RLS policies for the Supabase backend
yumyums_project_brief.md
```

## First-time setup

1. **Supabase**: create a project at [supabase.com](https://supabase.com),
   then from Project Settings → API grab the Project URL and `anon` public
   key for `mobile/.env`. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL editor to create the schema, RLS policies, and the
   `entry-photos` storage bucket.
2. **Google Cloud**: enable the Places API and Maps SDK (iOS + Android) on a
   project at [console.cloud.google.com](https://console.cloud.google.com),
   and create API keys for `mobile/.env` (see `mobile/.env.example` for which
   key goes where — the Places key is used client-side, the Maps SDK keys are
   native-build-only).
3. Follow [`mobile/README.md`](mobile/README.md) to install dependencies and
   run the app.
