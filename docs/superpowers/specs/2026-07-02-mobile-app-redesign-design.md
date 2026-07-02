# Mobile App Redesign — Port PR #2178

## Goal

Make `packages/mobile` match the provided UI designs (5 screenshots) and the
functionality of upstream reference PR
[AgentWrapper/agent-orchestrator#2178](https://github.com/AgentWrapper/agent-orchestrator/pull/2178).

That PR contains the actual app the screenshots come from: an Expo + expo-router
supervisor with four tabs (Kanban, PRs, Orchestrator, Settings), a spawn flow, a
live terminal, and a "Mission Control" theme the PR states mirrors AO's
`DESIGN.md`. This repo's current `packages/mobile` is an earlier hand-rolled
version (single `App.tsx`, manual routing, Courier-mono styling, three tabs, no
Orchestrator, no live terminal) that diverges heavily from the designs.

## Approach

Port the reference PR's app into `packages/mobile`, adapted to this repo's
workspace conventions, replacing the current hand-rolled implementation. The
live terminal is deferred; everything else is built now.

## Scope

In scope:

- Replace `App.tsx` + `src/` + `index.ts` with the reference PR's `expo-router`
  structure under `packages/mobile/app/` and `packages/mobile/lib/`.
- Four bottom tabs matching the designs: Kanban (`index`), PRs, Orchestrator,
  Settings.
- Kanban board: live pill, working/need-you/mergeable stat cards, repo filter
  chips, attention-grouped session sections, and a spawn FAB.
- PRs: repo chips, Open/Merged/All filter, PR cards with Session/Open/Merge.
- Orchestrator: per-project orchestrator cards with Open orchestrator / Restart.
- Settings: Host, API Port, Terminal Port, Use TLS toggle, Test connection,
  Save, and a Projects list.
- Spawn (new task) flow launched from the Kanban FAB.
- Live polling store, repo/project filtering, and the AO daemon HTTP client from
  the reference PR (`lib/api.ts`, `lib/config.ts`, `lib/store.tsx`).
- Keep the workspace package name `@agent-orchestrator/mobile`; change `main` to
  `expo-router/entry`.
- Add `packages/mobile/.gitignore`; stop tracking the committed `.expo/` and the
  old `index.ts`.

Out of scope (deferred):

- The live xterm.js terminal (embedded webview) and its websocket mux client
  (`lib/mux.ts`). The session screen ships as a stub (see below).
- `react-native-webview` and `@fressh/react-native-xtermjs-webview`
  dependencies.
- Push notifications, auth/tunneling, app-store publishing.

## Deferred terminal — session stub

`app/session/[id].tsx` ships as a functional stub matching screenshot 3's
chrome: a Back button, session title, a live/status pill, and a working **Kill**
action (a plain daemon API call). In place of the xterm webview it shows a clear
"Live terminal coming soon" placeholder. The Terminal Port field remains in
Settings (matches screenshot 5) so the follow-up terminal can use it without a
settings change.

## Architecture

`packages/mobile` becomes an expo-router app:

```
packages/mobile/
  app/_layout.tsx            root stack + safe-area provider + store provider
  app/(tabs)/_layout.tsx     bottom tab bar (Kanban | PRs | Orchestrator | Settings)
  app/(tabs)/index.tsx       Kanban board
  app/(tabs)/prs.tsx         Pull requests
  app/(tabs)/orchestrator.tsx  Orchestrators
  app/(tabs)/settings.tsx    Server connection + projects
  app/spawn.tsx              New task (FAB target)
  app/session/[id].tsx       Session detail — STUB (no live terminal yet)
  lib/api.ts                 daemon HTTP client + response types
  lib/config.ts             host/port/TLS config + URL building + persistence
  lib/store.tsx             polling store: sessions, stats, orchestrators, PRs, projects
  lib/theme.ts              Mission Control palette + status/attention helpers
  lib/ui.tsx                reusable primitives (cards, pills, buttons, chips)
  lib/SessionCard.tsx       session card used on the board
  lib/ProjectSwitcher.tsx   repo/project filter chips
  app.json                  expo-router plugin, URL scheme, Android cleartext
  package.json              deps + main: expo-router/entry
  tsconfig.json             expo-router-aware strict config
  .gitignore                .expo, node_modules, expo-env.d.ts, build output
  README.md                 run + daemon-connection instructions
```

The app must not import Electron or desktop renderer code. It talks only to the
AO daemon HTTP API over the user-configured host/port/TLS. The daemon URL is
user-configured because a phone cannot assume desktop loopback.

## Data flow

`lib/config.ts` persists host, API port, terminal port, and the TLS flag via
AsyncStorage and derives the HTTP base URL. `lib/store.tsx` polls the daemon for
the dashboard payload (sessions + stats), orchestrator links, projects, and pull
requests, and exposes the current selection/filter plus mutations (spawn task,
merge PR, open/restart orchestrator, kill session). Screens read from the store
and render the states below. Mutations refresh affected data on success and keep
inline error messages on failure.

## UI behavior and states

- Not configured: Settings-first prompt; other tabs show a connect hint.
- Daemon unreachable: retry + edit-connection affordances; "live" pill reflects
  connection state.
- Empty board / empty PRs / no orchestrators: quiet empty states.
- Repo filter chips ("All" + per project) filter the board and PR list.
- Mutation in progress: disable duplicate actions, show inline progress.
- Mutation failed: inline error, preserve input.
- Destructive actions (Kill session) confirm before calling the API.

## Design system

Port the reference PR's `lib/theme.ts` verbatim (near-black surfaces, single
bordered card surface, blue = conductor/primary, orange = working, amber =
needs-you, red = failing, green = mergeable/done). The PR states this mirrors
AO's `DESIGN.md`, which satisfies the repo's "clone agent-orchestrator verbatim"
rule; do not invent styling.

## Dependencies

Add: `expo-router`, `react-native-safe-area-context`, `react-native-screens`,
`expo-linking`, `expo-constants`, `expo-build-properties`. Keep:
`@react-native-async-storage/async-storage`, `@expo/vector-icons`, `expo`,
`expo-status-bar`, `react`, `react-native`. Omit (deferred terminal):
`react-native-webview`, `@fressh/react-native-xtermjs-webview`.

## Testing and verification

- `npm run build:mobile` from repo root passes (runs `tsc --noEmit`).
- `cd packages/mobile && npm run typecheck` passes.
- `git status --porcelain` is clean except known unrelated metadata; no
  `node_modules`, `.expo`, or `expo-env.d.ts` tracked.
- Manual run instructions documented in `packages/mobile/README.md`.

## Implementation notes

Port faithfully rather than re-architecting: adapt the reference files to the
`packages/mobile` path and this repo's package/tsconfig conventions, remove the
terminal (webview + mux) pieces, and stub the session screen. Keep each change
surgical and each file focused.
