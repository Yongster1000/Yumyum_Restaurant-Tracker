# Yumyums — Project Brief

A mobile app for tracking restaurants and places to eat, similar to a dedicated "Saved places" list in Google Maps — but with ratings, photos, comments, and the ability to see what other users have saved and reviewed.

## Overview

- **Primary user**: solo use initially, designed from day one to support multiple accounts.
- **Core idea**: a shared global list of *places* (restaurants), with each user maintaining their own independent *entry* (rating, comment, photos, visited status) per place.
- **Key differentiator from a simple bookmarking app**: a Discover feed where users can browse places other users have saved and add them to their own list.

## Tech stack

- **Frontend**: React Native via Expo (cross-platform iOS/Android, single codebase, fast local testing via Expo Go / dev client without needing app store submission).
- **Backend**: Supabase — Postgres database, Supabase Auth, Supabase Storage for photos.
- **Maps/Places**: Google Places API + Maps SDK for restaurant search/autocomplete and map display.
- **Distribution (later, optional)**: Expo EAS Build for producing installable builds; Apple Developer account ($99/yr) and/or Google Play Developer account ($25 one-time) only needed if publishing to app stores.

## Data model

Relational schema (Postgres via Supabase). Rationale: a "place" is an objective, shared fact; a "rating/comment/photo" is a subjective, per-user opinion — so these are modeled as separate tables rather than fields on one record. This avoids duplicate place records when multiple users save the same restaurant, and makes the Discover feed a simple join rather than a special case.

### `User`
| Field | Type | Notes |
|---|---|---|
| id | uuid | matches Supabase Auth `uid` |
| display_name | text | |
| created_at | timestamp | |

### `Place`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| google_place_id | text | dedup key from Google Places API |
| name | text | |
| address | text | |
| lat / lng | numeric | |
| cost_bracket | text | optional, e.g. $ / $$ / $$$ |

### `FoodType`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | global, growing list (e.g. "Japanese", "Ramen", "Cafe") |

### `PlaceFoodTypes` (join table — many-to-many)
| Field | Type | Notes |
|---|---|---|
| place_id | uuid | FK → Place |
| food_type_id | uuid | FK → FoodType |

Composite primary key on (`place_id`, `food_type_id`). A place can have multiple food types (e.g. a fusion restaurant tagged both "Korean" and "BBQ").

### `Entry` (join table with data — one per user per place)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → User |
| place_id | uuid | FK → Place |
| rating | integer | nullable until visited |
| visited | boolean | |
| comment | text | nullable |
| photos | text[] | array of Storage URLs |
| created_at | timestamp | |
| updated_at | timestamp | |

Unique constraint on (`user_id`, `place_id`) — one entry per user per place. Users manually update/overwrite their own entry on repeat visits rather than the app tracking a visit history.

## Core flows

### Search-before-create (applies to both Places and FoodTypes)
When adding a new place, show a search interface (backed by Google Places autocomplete) alongside fuzzy-matched existing saved places. If the place already exists in the database, the new entry attaches to the existing `Place` row. If not, create a new `Place` row using the Google `place_id` as the dedup key. The same pattern applies to `FoodType`: search the global list first, allow adding a new type only if no match exists.

### Add/edit entry
Single form covering: place selection (search-before-create), food type multi-select (chips, with "add new" option), visited toggle, star rating (only meaningful once visited), comment text, and photo upload (multiple images to Supabase Storage).

### Discover → add to own list
Browsing another user's saved place lets the current user add it to their own list as a *new, separate Entry* tied to the same existing `Place` row — defaulting to `visited: false` with blank rating/comment/photos. The `Place` record itself is never duplicated or modified by this action.

## Screens

1. **Own page** — list of the current user's saved places (their `Entry` rows joined to `Place`). Sort by rating and/or location; filter by food type. Visited entries show a star rating; unvisited entries show a "want to try" badge instead. Floating "+" button to add a new place. Bottom tab bar switches between Own and Discover.
2. **Discover page** — global list of other users' `Entry` rows joined to `Place`, filterable by user. Each item has a quick "add to my list" action (see flow above).
3. **Add/edit entry** — the form described above.
4. **Place detail** — shows the place's shared info (name, address, map, food type tags) plus every user's `Entry` for that place (avatar, rating, comment, photos), so it doubles as the read view for both the Own and Discover flows.

## Auth

Supabase Auth (email/password or Google/Apple sign-in). `User.id` is the Supabase Auth `uid` — no custom password/session handling. Row Level Security policies should enforce that a user can only insert/update/delete their own `Entry` rows, while `Place` and `FoodType` rows are readable by all authenticated users and insertable by any authenticated user (since they're shared, deduplicated data).

## Wireframes

A low-fidelity HTML wireframe reference covering all four screens has been produced separately (`yumyums_wireframes.html`) and should be treated as a structural reference for layout only — not final visual design.

## Open decisions / things to confirm before or during build

- Whether the rating input should be disabled/hidden in the Add/edit entry form until "visited" is toggled on.
- Exact cost_bracket representation (free-text vs. fixed $ / $$ / $$$ enum).
- Sign-in method: plain email/password vs. Google/Apple OAuth via Supabase Auth.
- Whether Discover's "filter by user" should support multi-select or single-user filtering only.
