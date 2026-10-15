# remotion-brief — PLAN

Source: https://x.com/flxrnc/status/2109266407338934719

## Goal
Type a one-line brief and see a short kinetic-typography clip preview live in the Remotion Player.

## MVP (single user, single screen)
- One text input for the brief.
- A `@remotion/player` Player below it that animates the brief's words live as you type.
- A few preset motion styles (e.g. pop-in, slide-stagger, scale-punch), picked **deterministically** from the brief (hash of the text) with an optional manual override toggle.
- ~3–5s clip, loops.

### Out of scope
- Video export / rendering.
- AI calls or AI-generated scenes.
- Accounts, persistence, sharing, audio.

## Stack
- Bun; `bunfig.toml` with `[install] minimumReleaseAge = 259200` created first.
- `bunx create-vite@latest . --template react-ts`.
- `remotion` + `@remotion/player`.
- shadcn/ui, minimalist preset (Input, Card, ToggleGroup/Select).
- Runs with `bun install && bun run dev`.

## Tasks (vertical slices)
1. Scaffold + bunfig + Player rendering a hardcoded word sequence (playable).
2. Wire input → composition props; words animate live.
3. Preset motion styles + deterministic picker (hash → style); manual override.
4. shadcn minimalist polish; motion tuning (easing, stagger, timing) per emil-design-eng/animate judgment.
5. Screenshot + video for the PR.

## Testing
- Unit test only the deterministic style picker and word-timing math (`bun test`).

## Deferred
- Phase 2: MP4 export (@remotion/renderer / Lambda).
- Phase 3: AI-generated scenes/styles from the brief.
