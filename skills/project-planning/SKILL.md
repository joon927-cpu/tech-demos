---
name: project-planning
description: MVP-first planning for Bun + shadcn demo apps in apps/<slug>/.
---
# Project planning (MVP-first)

Write `apps/<slug>/PLAN.md` with these sections:

1. **Goal** — one sentence.
2. **MVP** — single-user, smallest playable version. Followed by explicit **Out of scope** bullets.
3. **Stack** — Bun runtime; scaffold with official `bunx create-*` tools (e.g. `bunx create-vite`); shadcn/ui with the minimalist preset. Prefer prebuilt components/libraries over bespoke code.
4. **Tasks** — vertical slices, each ending in something runnable/visible. First slice = smallest end-to-end playable thing.
5. **Testing** — tests only for critical logic; no test scaffolding for UI glue.
6. **Deferred** — later phases explicitly listed, not built.

Rules: add `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install; app must run with `bun install && bun run dev`; defer anything non-MVP.
