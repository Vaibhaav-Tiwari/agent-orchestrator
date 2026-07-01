# Mobile App Design

## Goal

Build a real React Native mobile app under `packages/mobile` so collaborators can work on mobile features from the fork. The app should be a first full-control mobile surface for Agent Orchestrator: useful for supervising projects and sessions, managing agent work, and reviewing PR state from a phone.

## Scope

The first implementation includes:

- Expo + React Native + TypeScript app tracked in Git under `packages/mobile`.
- Package scripts wired to the existing root `npm run build:mobile` command.
- Daemon connection settings, because a phone cannot assume the desktop daemon is reachable at `127.0.0.1`.
- Projects list and project detail views.
- Session board/list, session detail, and session rename/control actions where the daemon API supports them.
- New task flow for spawning worker sessions.
- Pull request list/detail status surface.
- Loading, empty, error, retry, and offline/unconfigured states.
- Local persistence for daemon URL and lightweight UI preferences.

Out of scope for the first implementation:

- Native terminal emulation parity with the desktop app.
- Embedded browser/preview parity.
- Push notifications.
- Authentication or remote tunneling.
- Publishing to app stores.

Terminal and browser parity should be designed as follow-up mobile surfaces after the API-connected supervisor/control app is stable.

## Architecture

`packages/mobile` will be a standalone workspace package:

- `package.json` declares Expo, React Native, TypeScript, navigation, and build/typecheck scripts.
- `app.json` contains Expo app metadata.
- `tsconfig.json` keeps strict TypeScript settings.
- `App.tsx` boots providers and navigation.
- `src/api` contains a small daemon client configured from mobile settings.
- `src/storage` persists daemon URL and preferences.
- `src/screens` owns route-level screens.
- `src/components` owns reusable mobile UI.
- `src/types` contains mobile-local types or imports shared/generated API types when available.

The app should not import Electron or desktop renderer code. Shared API schemas may be reused once `packages/shared/src` exists consistently; until then, mobile should keep a small typed client boundary that can be swapped for shared types later.

## Navigation

Use a simple stack/tab structure:

- Projects tab: all projects and daemon connection state.
- PRs tab: open/relevant pull requests.
- Settings tab: daemon URL and diagnostics.
- Project detail stack: board/list of sessions, new task, project settings shortcut.
- Session detail stack: status, branch, PRs, actions, and recent metadata.

Navigation should favor mobile-native screens over trying to mirror desktop panels exactly.

## Data Flow

The mobile API client reads the saved daemon base URL and calls the daemon HTTP API. Query hooks own fetching, refresh, retries, and error mapping. Mutations invalidate relevant project/session/PR queries after success.

Required client capabilities:

- Fetch workspaces/projects.
- Fetch session details when available.
- Spawn a task for a project.
- Rename a session when supported.
- Stop/kill a session when supported.
- Fetch PR summaries/status.

If an endpoint is missing or differs from expectation, the UI should disable that action with a clear state instead of hiding failures.

## UI Behavior

The app should feel like an operational supervisor, not a marketing page. Screens should be dense but readable, with clear status colors, compact cards, and obvious primary actions.

Key states:

- No daemon URL configured: show a settings-first connection prompt.
- Daemon unreachable: show retry and edit connection actions.
- Empty projects: show a quiet empty state.
- Project with active sessions: show grouped status sections.
- Mutation in progress: disable duplicate actions and show inline progress.
- Mutation failed: show inline error and preserve user input.

## Error Handling

Normalize API errors at the client boundary into displayable messages. Preserve request IDs if the daemon returns them. Network errors should distinguish unreachable daemon from daemon-side failures.

Destructive actions such as stop/kill session require confirmation before calling the API.

## Testing And Verification

Minimum verification for the first implementation:

- `npm run build:mobile` passes from the repo root.
- `cd packages/mobile && npm run typecheck` passes.
- Unit tests cover API URL handling, error normalization, and key screen states if the chosen test tooling is available without broad dependency churn.
- Manual run instructions are documented in `packages/mobile/README.md`.

## Implementation Notes

Keep the first implementation reviewable. Prefer a complete, working mobile control app over a partial desktop parity port. Do not commit generated Expo local state, `node_modules`, or `expo-env.d.ts`.
