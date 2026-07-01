# Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and commit a real Expo React Native mobile control app under `packages/mobile`.

**Architecture:** The mobile app is a standalone workspace package with a small typed daemon client, persisted connection settings, reusable compact UI primitives, and screen-level navigation/state. It does not import Electron or desktop renderer code, but it follows the provided AO/ReverbCode design language: dense, near-black, hairline-bordered operational UI with blue accent and status colors.

**Tech Stack:** Expo, React Native, TypeScript, React, lightweight local state with React hooks, React Native `fetch`, and `AsyncStorage`-compatible persistence using React Native `Platform` fallback where available.

## Global Constraints

- App source lives under `packages/mobile`.
- Do not commit `node_modules`, `.expo`, or `expo-env.d.ts`.
- `npm run build:mobile` from repo root must pass.
- `cd packages/mobile && npm run typecheck` must pass.
- Use system fonts and AO/ReverbCode color tokens from `DESIGN.md`: near-black canvas, hairline borders, blue accent, amber/green/red status colors.
- Keep the UI operational and dense: no landing page, no decorative hero, no marketing copy.
- The daemon URL is user-configured because mobile devices cannot assume desktop loopback.

---

## File Structure

- Create `packages/mobile/package.json`: workspace package metadata and scripts.
- Create `packages/mobile/app.json`: Expo app metadata.
- Create `packages/mobile/tsconfig.json`: strict TypeScript config.
- Create `packages/mobile/App.tsx`: provider composition and root navigation.
- Create `packages/mobile/README.md`: run instructions and daemon URL notes.
- Create `packages/mobile/src/theme.ts`: AO color/spacing/type tokens.
- Create `packages/mobile/src/types.ts`: mobile API/domain types.
- Create `packages/mobile/src/api/client.ts`: daemon URL normalization, API errors, HTTP helpers, action functions.
- Create `packages/mobile/src/storage/settings.ts`: daemon URL persistence.
- Create `packages/mobile/src/hooks/useDaemon.ts`: query/mutation state for projects, sessions, PRs, and controls.
- Create `packages/mobile/src/components/*`: compact UI primitives and domain cards.
- Create `packages/mobile/src/screens/*`: Projects, Project Detail, Session Detail, PRs, Settings, New Task.

---

### Task 1: Workspace And Expo Shell

**Files:**
- Create: `packages/mobile/package.json`
- Create: `packages/mobile/app.json`
- Create: `packages/mobile/tsconfig.json`
- Create: `packages/mobile/App.tsx`
- Create: `packages/mobile/README.md`

**Interfaces:**
- Produces: a package where `npm run typecheck` runs `tsc --noEmit`.
- Produces: root `npm run build:mobile` works through the existing root script.

- [ ] **Step 1: Write shell files**

Create the package, Expo metadata, TypeScript config, root `App`, and README. `App.tsx` should render a simple dark loading/app container that will be replaced by later tasks.

- [ ] **Step 2: Verify package scripts**

Run: `cd packages/mobile && npm run typecheck`

Expected: TypeScript either passes or reports only missing app files from later tasks. Fix shell-level config errors before proceeding.

- [ ] **Step 3: Commit**

Run:

```bash
git add packages/mobile/package.json packages/mobile/app.json packages/mobile/tsconfig.json packages/mobile/App.tsx packages/mobile/README.md
git commit -m "feat(mobile): add Expo app shell"
```

---

### Task 2: Theme, Types, API Client, And Settings Storage

**Files:**
- Create: `packages/mobile/src/theme.ts`
- Create: `packages/mobile/src/types.ts`
- Create: `packages/mobile/src/api/client.ts`
- Create: `packages/mobile/src/storage/settings.ts`

**Interfaces:**
- Produces: `normalizeDaemonUrl(input: string): string`
- Produces: `formatApiError(error: unknown): string`
- Produces: `createDaemonClient(baseUrl: string): DaemonClient`
- Produces: `loadSettings(): Promise<MobileSettings>`
- Produces: `saveSettings(settings: MobileSettings): Promise<void>`

- [ ] **Step 1: Implement theme and types**

Define compact AO tokens and mobile domain types for projects, sessions, PR summaries, settings, and action payloads.

- [ ] **Step 2: Implement daemon client**

Implement URL normalization, error envelopes with request IDs, and methods for:

- `getWorkspaces()`
- `getSession(sessionId)`
- `createTask(projectId, input)`
- `renameSession(sessionId, name)`
- `stopSession(sessionId)`
- `killSession(sessionId)`
- `getPullRequests()`

- [ ] **Step 3: Implement settings storage**

Use `AsyncStorage` when available, and fall back to in-memory storage for typecheck/test environments.

- [ ] **Step 4: Verify**

Run: `cd packages/mobile && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/mobile/src/theme.ts packages/mobile/src/types.ts packages/mobile/src/api/client.ts packages/mobile/src/storage/settings.ts
git commit -m "feat(mobile): add daemon client and settings"
```

---

### Task 3: App State Hook And Reusable UI

**Files:**
- Create: `packages/mobile/src/hooks/useDaemon.ts`
- Create: `packages/mobile/src/components/ActionButton.tsx`
- Create: `packages/mobile/src/components/AppFrame.tsx`
- Create: `packages/mobile/src/components/EmptyState.tsx`
- Create: `packages/mobile/src/components/ProjectCard.tsx`
- Create: `packages/mobile/src/components/SessionCard.tsx`
- Create: `packages/mobile/src/components/StatusPill.tsx`

**Interfaces:**
- Consumes: `createDaemonClient`, `loadSettings`, `saveSettings`.
- Produces: `useDaemonController(): DaemonController`
- Produces: compact reusable components used by all screens.

- [ ] **Step 1: Implement state hook**

The hook should load settings, fetch workspaces/PRs, expose refresh/retry, and expose mutations for task creation, rename, stop, and kill. Mutations refresh data after success and keep inline error messages after failure.

- [ ] **Step 2: Implement reusable UI**

Components use AO tokens: dark backgrounds, 1px borders, blue primary actions, amber/green/red statuses, compact typography, and no decorative art.

- [ ] **Step 3: Verify**

Run: `cd packages/mobile && npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/mobile/src/hooks/useDaemon.ts packages/mobile/src/components
git commit -m "feat(mobile): add app state and UI primitives"
```

---

### Task 4: Screens And Navigation

**Files:**
- Modify: `packages/mobile/App.tsx`
- Create: `packages/mobile/src/screens/ProjectsScreen.tsx`
- Create: `packages/mobile/src/screens/ProjectDetailScreen.tsx`
- Create: `packages/mobile/src/screens/SessionDetailScreen.tsx`
- Create: `packages/mobile/src/screens/PullRequestsScreen.tsx`
- Create: `packages/mobile/src/screens/SettingsScreen.tsx`
- Create: `packages/mobile/src/screens/NewTaskScreen.tsx`

**Interfaces:**
- Consumes: `DaemonController` and reusable components.
- Produces: visible mobile app with Projects, PRs, Settings, Project Detail, Session Detail, and New Task flows.

- [ ] **Step 1: Implement manual tab/stack navigation**

Keep navigation dependency-light: use local React state for selected tab, project, session, and modal-like new task screen.

- [ ] **Step 2: Implement Projects screen**

Show connection state, project cards, active session counts, and empty/error states.

- [ ] **Step 3: Implement Project Detail and New Task screens**

Group sessions by status zone, show compact session cards, and provide a task spawn form with title/brief.

- [ ] **Step 4: Implement Session Detail screen**

Show status, branch, provider, PRs, rename field, stop/kill confirmation, and action error states.

- [ ] **Step 5: Implement PRs and Settings screens**

Show PR status summaries and daemon URL configuration with save/test/refresh behavior.

- [ ] **Step 6: Verify**

Run: `cd packages/mobile && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/mobile/App.tsx packages/mobile/src/screens
git commit -m "feat(mobile): add supervisor screens"
```

---

### Task 5: Final Verification And Push

**Files:**
- Modify as needed only for build/typecheck fixes.

**Interfaces:**
- Consumes: completed app.
- Produces: fork branch with mobile app committed and pushed.

- [ ] **Step 1: Run root mobile build**

Run: `npm run build:mobile`

Expected: PASS.

- [ ] **Step 2: Run mobile typecheck**

Run: `cd packages/mobile && npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Check Git status**

Run: `git status --porcelain`

Expected: only known unrelated `frontend/package-lock.json` metadata entry remains unstaged, or clean.

- [ ] **Step 4: Push fork**

Run:

```bash
git push fork main
```

Expected: push succeeds.

---

## Self-Review

- Spec coverage: package scaffold, daemon settings, projects, sessions, PRs, task spawn, rename/control actions, error/empty/loading states, and verification are covered.
- Design coverage: AO/ReverbCode dense dark style, status colors, compact cards, and non-marketing first screen are covered.
- Scope boundary: terminal/browser parity, push notifications, auth/tunneling, and app-store publishing remain out of scope as specified.
- Placeholder scan: no `TBD` or implementation placeholders remain.
- Type consistency: exported client, settings, and hook names are consistent across tasks.
