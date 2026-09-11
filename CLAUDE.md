# Orchestrator workflow

This repo uses three project subagents defined in `.claude/agents/`:

- **frontend** — Expo Router screens/components/navigation/styling (`mobile/src/app`, `mobile/src/components`, `mobile/src/hooks`, `mobile/src/constants`).
- **backend** — Supabase schema/migrations/RLS and the client data layer (`supabase/migrations`, `mobile/src/lib/*`, `mobile/src/types/database.ts`).
- **testing** — typecheck/lint, verifying changes actually work (including launching the app), and adding automated tests when asked.

For any non-trivial feature or fix, act as orchestrator: break the work along these lines, delegate via the Agent tool to the matching subagent(s) (`subagent_type: "frontend" | "backend" | "testing"`), and run independent frontend/backend work in parallel when there's no dependency between them. Run `testing` after `frontend`/`backend` finish to verify their changes rather than trusting a compile pass. For a small, single-file, single-domain change, just make the edit directly instead of delegating — the subagents are for coordinating multi-part work, not a mandatory detour for everything.

Each subagent file also has its own `AGENTS.md` reminder: Expo's SDK (v57) has changed recently, so check `mobile/AGENTS.md` / https://docs.expo.dev/versions/v57.0.0/ before writing Expo/React Native code rather than relying on older training knowledge.

# Branching & releases

`Development` is the working branch; `main` is production, updated only via PR from `Development` (see the README's "Branching & environments" section for the full Git/EAS split). Don't push or commit directly to `main` unless the user explicitly asks for a release/hotfix.

When work does land on `main` (a release or hotfix), append an entry to `DEVLOG.md` describing what changed and why, following the file's existing format (dated entries, newest at the bottom of each day's section, open issues tracked at the top). Routine `Development`-branch work doesn't require a DEVLOG entry unless the user asks.
