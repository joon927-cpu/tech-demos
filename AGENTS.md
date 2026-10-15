# tech-demos — agent rules

This is Joon's ONE shared monorepo for tech demos. **Never create new repos.** Every demo lives in `apps/<slug>/`.

1. Cloud agents only touch `apps/<slug>/` for the demo they were assigned. Nothing outside it.
2. Each app is self-contained and runs with `bun install && bun run dev` from its own directory.
3. Runtime: **Bun**.
4. Every app has a root `bunfig.toml` created **before any install**:
   ```toml
   [install]
   minimumReleaseAge = 259200
   ```
5. Plan with `skills/project-planning/SKILL.md`; the plan lives at `apps/<slug>/PLAN.md`.
6. Every PR must attach at least one **screenshot** AND at least one **video** of the running app.
7. Never create new repos.
