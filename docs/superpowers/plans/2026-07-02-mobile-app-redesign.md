# Mobile App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `packages/mobile` app with a port of upstream PR #2178's expo-router supervisor so the app matches the 5 provided screenshots and their functionality, with the live terminal deferred (session screen stubbed).

**Architecture:** `packages/mobile` becomes an expo-router app (`app/` routes + `lib/` domain code) ported from the reference PR, adapted to this repo's workspace. The websocket terminal mux and xterm webview are omitted; `lib/store.tsx` is rewritten to poll the daemon over REST only and derive a connection status. The session route ships as a functional stub with a working Kill.

**Tech Stack:** Expo SDK 54, expo-router, React Native 0.81, React 19, TypeScript (strict), `@react-native-async-storage/async-storage`, `@expo/vector-icons`, `react-native-safe-area-context`, `react-native-screens`.

## Global Constraints

- App source lives under `packages/mobile`; package name stays `@agent-orchestrator/mobile`.
- Do not commit `node_modules`, `.expo`, or `expo-env.d.ts` (enforced by `packages/mobile/.gitignore`).
- `npm run build:mobile` from repo root must pass (it runs `tsc --noEmit` in `packages/mobile`).
- `cd packages/mobile && npm run typecheck` must pass.
- No Electron/desktop-renderer imports; the app talks only to the AO server HTTP API at the user-configured host/port/TLS.
- Do not add the deferred terminal deps: `react-native-webview`, `@fressh/react-native-xtermjs-webview`. Do not create `lib/mux.ts`.
- Reference source files are saved under the session scratchpad `ref/` directory (paths given per file as `ref/<mangled>`); "port verbatim" means copy that content unchanged except where adaptations are listed.

---

## File Structure

```
packages/mobile/
  package.json            main: expo-router/entry; deps + scripts        (MODIFY)
  app.json                expo-router plugin, scheme, Android cleartext   (OVERWRITE)
  tsconfig.json           extends expo/tsconfig.base, strict             (OVERWRITE)
  images.d.ts             png module declaration                          (CREATE)
  .gitignore              .expo/node_modules/expo-env.d.ts/…             (CREATE)
  README.md               run + daemon-connection instructions           (OVERWRITE)
  assets/                 icon/splash/favicon/android-fg/mascot pngs      (CREATE)
  lib/theme.ts            palette + status/attention helpers  (port)     (CREATE)
  lib/config.ts           host/port/TLS config + URLs         (port)     (CREATE)
  lib/api.ts              daemon HTTP client + types          (port)     (CREATE)
  lib/store.tsx           REST-only polling store             (ADAPTED)  (CREATE)
  lib/ui.tsx              reusable primitives                 (port)     (CREATE)
  lib/SessionCard.tsx     board session card                  (port)     (CREATE)
  lib/ProjectSwitcher.tsx repo filter chips                   (port)     (CREATE)
  app/_layout.tsx         root stack + providers              (port)     (CREATE)
  app/(tabs)/_layout.tsx  bottom tabs                         (port)     (CREATE)
  app/(tabs)/index.tsx    Kanban board                        (port)     (CREATE)
  app/(tabs)/prs.tsx      Pull requests                       (port)     (CREATE)
  app/(tabs)/orchestrator.tsx  orchestrators                  (port)     (CREATE)
  app/(tabs)/settings.tsx server connection + projects        (port)     (CREATE)
  app/spawn.tsx           new-agent modal                     (port)     (CREATE)
  app/session/[id].tsx    session detail                      (STUB)     (CREATE)
```

Removed: `App.tsx`, `index.ts`, `src/` (entire tree).

---

### Task 1: Package config, cleanup, assets, install

**Files:**
- Modify: `packages/mobile/package.json`
- Overwrite: `packages/mobile/app.json`, `packages/mobile/tsconfig.json`
- Create: `packages/mobile/images.d.ts`, `packages/mobile/.gitignore`, `packages/mobile/assets/*`
- Delete: `packages/mobile/App.tsx`, `packages/mobile/index.ts`, `packages/mobile/src/` (all)

**Interfaces:**
- Produces: an installable expo-router package whose `main` is `expo-router/entry` and whose `npm run typecheck` runs `tsc --noEmit`.

- [ ] **Step 1: Write `packages/mobile/package.json`**

```json
{
  "name": "@agent-orchestrator/mobile",
  "version": "0.0.0",
  "private": true,
  "description": "Expo mobile supervisor for Agent Orchestrator",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "build": "npm run typecheck"
  },
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "@react-native-async-storage/async-storage": "2.2.0",
    "expo": "^54.0.0",
    "expo-build-properties": "~1.0.10",
    "expo-constants": "~18.0.13",
    "expo-linking": "~8.0.12",
    "expo-router": "~6.0.24",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-native-safe-area-context": "~5.6.2",
    "react-native-screens": "~4.16.0"
  },
  "devDependencies": {
    "@types/react": "~19.1.10",
    "typescript": "~5.9.2"
  }
}
```

- [ ] **Step 2: Overwrite `packages/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 3: Create `packages/mobile/images.d.ts`** (port verbatim from `ref/images.d.ts`)

```ts
// Static image imports (Metro resolves these to an asset reference at runtime,
// which React Native's <Image source> accepts as a number).
declare module "*.png" {
	const content: number;
	export default content;
}
```

- [ ] **Step 4: Create `packages/mobile/.gitignore`** (port verbatim from `ref/.gitignore`, drop the `.claude` line — this repo tracks its own agent config)

```
# dependencies
node_modules/

# Expo
.expo/
dist/
web-build/
expo-env.d.ts

# Native
.kotlin/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# debug
npm-debug.*
yarn-debug.*
yarn-error.*

# macOS
.DS_Store
*.pem

# local env files
.env*.local

# typescript
*.tsbuildinfo

# generated native folders
/ios
/android

# logs
*.log
```

- [ ] **Step 5: Overwrite `packages/mobile/app.json`** (port from `ref/app.json`; remove the EAS `extra.eas.projectId` and `owner` fields — those are the upstream author's account)

```json
{
	"expo": {
		"name": "AO",
		"slug": "ao-mobile",
		"version": "1.0.0",
		"orientation": "portrait",
		"icon": "./assets/icon.png",
		"userInterfaceStyle": "dark",
		"backgroundColor": "#0a0b0d",
		"scheme": "aomobile",
		"splash": {
			"image": "./assets/splash-icon.png",
			"resizeMode": "contain",
			"backgroundColor": "#0a0b0d"
		},
		"ios": {
			"supportsTablet": true,
			"bundleIdentifier": "aoagents.ao",
			"config": { "usesNonExemptEncryption": false }
		},
		"android": {
			"package": "aoagents.ao",
			"adaptiveIcon": {
				"backgroundColor": "#0a0b0d",
				"foregroundImage": "./assets/android-icon-foreground.png"
			},
			"predictiveBackGestureEnabled": false
		},
		"web": { "favicon": "./assets/favicon.png", "bundler": "metro" },
		"plugins": [
			"expo-router",
			["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
		],
		"extra": { "router": {} }
	}
}
```

- [ ] **Step 6: Fetch binary assets** into `packages/mobile/assets/` from the PR head (icon.png, splash-icon.png, favicon.png, android-icon-foreground.png, mascot.png):

```bash
SHA=$(gh pr view 2178 --repo AgentWrapper/agent-orchestrator --json headRefOid -q .headRefOid)
mkdir -p packages/mobile/assets
for a in icon splash-icon favicon android-icon-foreground mascot; do
  gh api "repos/AgentWrapper/agent-orchestrator/contents/mobile/assets/$a.png?ref=$SHA" -q .content \
    | base64 -d > "packages/mobile/assets/$a.png"
done
file packages/mobile/assets/*.png
```

Expected: five `PNG image data` files.

- [ ] **Step 7: Remove the old app files**

```bash
git rm -q packages/mobile/App.tsx
rm -f packages/mobile/index.ts
rm -rf packages/mobile/src packages/mobile/.expo
```

- [ ] **Step 8: Install workspace deps**

Run: `npm install`
Expected: completes; new expo-router/safe-area/screens deps resolve under the workspace.

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/package.json packages/mobile/app.json packages/mobile/tsconfig.json \
  packages/mobile/images.d.ts packages/mobile/.gitignore packages/mobile/assets package-lock.json
git add -u packages/mobile
git commit -m "feat(mobile): switch to expo-router shell and assets"
```

---

### Task 2: Domain library (`lib/`)

**Files:**
- Create: `packages/mobile/lib/theme.ts`, `lib/config.ts`, `lib/api.ts`, `lib/ui.tsx`, `lib/SessionCard.tsx`, `lib/ProjectSwitcher.tsx`
- Create: `packages/mobile/lib/store.tsx` (adapted, full code below)

**Interfaces:**
- Produces (from `lib/api.ts`): types `DashboardPR`, `DashboardSession`, `OrchestratorLink`, `ProjectInfo`, `DashboardStats`; functions `getProjects`, `getSessions`, `killSession`, `restoreSession`, `sendMessage`, `spawnSession`, `launchOrchestrator`, `mergePR`, `pingServer`, `attentionOf`, `sessionTitle`, `collectPRs`, `isTerminalStatus`.
- Produces (from `lib/config.ts`): type `ServerConfig`; `DEFAULT_CONFIG`, `loadConfig`, `saveConfig`, `httpBase`, `isConfigured`, `useServerConfig`.
- Produces (from `lib/theme.ts`): `theme`, `attentionMeta`, `statusVisual`, `statusColor`, `ciColor`, `ciVisual`; types `AttentionLevel`, `StatusVisual`, `CiVisual`.
- Produces (from `lib/store.tsx`): `AppProvider`, `useApp`, `useVisibleSessions`, `usePRs`; `AppState.connection` is `"closed" | "connecting" | "open"`.
- Produces (from `lib/ui.tsx`): `Dot`, `Pill`, `StatusBadge`, `Chip`, `Card`, `SectionHeader`, `ScreenHeader`, `Button`, `ConnectionPill`, `EmptyState`.

- [ ] **Step 1: Port `lib/theme.ts` verbatim** from `ref/lib_theme.ts` (no changes).

- [ ] **Step 2: Port `lib/config.ts` verbatim** from `ref/lib_config.ts` (no changes; keeps `muxPort` — the Terminal Port field the follow-up terminal will use).

- [ ] **Step 3: Port `lib/api.ts` verbatim** from `ref/lib_api.ts` (no changes).

- [ ] **Step 4: Port `lib/ui.tsx` verbatim** from `ref/lib_ui.tsx` (imports `../assets/mascot.png`, now present).

- [ ] **Step 5: Port `lib/SessionCard.tsx` verbatim** from `ref/lib_SessionCard.tsx`. Note: its imports are relative to `lib/` (`./api`, `./theme`, `./ui`) — keep as-is.

- [ ] **Step 6: Port `lib/ProjectSwitcher.tsx` verbatim** from `ref/lib_ProjectSwitcher.tsx` (no changes).

- [ ] **Step 7: Create `lib/store.tsx` (ADAPTED — REST-only, no mux).** This is the reference store with the mux client, live-patch merge, and mux-only `extras`/`send`-over-socket removed. `connection` is derived from fetch results.

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	collectPRs,
	getProjects,
	getSessions,
	killSession,
	launchOrchestrator as apiLaunchOrchestrator,
	mergePR as apiMergePR,
	restoreSession,
	sendMessage,
	spawnSession,
	type DashboardPR,
	type DashboardSession,
	type DashboardStats,
	type OrchestratorLink,
	type ProjectInfo,
} from "./api";
import { isConfigured, loadConfig, type ServerConfig } from "./config";

const ACTIVE_PROJECT_KEY = "ao.activeProject";
const POLL_INTERVAL_MS = 8000;

// Live terminal (mux websocket) is deferred, so connection state is derived from
// the REST poll: connecting until the first response, open on success, closed on
// error / when unconfigured.
export type ConnStatus = "closed" | "connecting" | "open";

type AppState = {
	config: ServerConfig | null;
	configured: boolean;
	projects: ProjectInfo[];
	sessions: DashboardSession[];
	orchestrators: OrchestratorLink[];
	orchestratorId: string | null;
	stats: DashboardStats;
	activeProjectId: string; // 'all' or a projectId
	connection: ConnStatus;
	loading: boolean;
	error: string | null;
	// actions
	reloadConfig: () => Promise<void>;
	refresh: () => Promise<void>;
	setActiveProject: (id: string) => void;
	spawn: (prompt?: string, projectId?: string) => Promise<void>;
	launchConductor: (projectId: string, clean?: boolean) => Promise<OrchestratorLink>;
	merge: (pr: DashboardPR) => Promise<void>;
	kill: (id: string) => Promise<void>;
	restore: (id: string) => Promise<void>;
	send: (id: string, message: string) => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error("useApp must be used within <AppProvider>");
	return ctx;
}

export function useVisibleSessions(): DashboardSession[] {
	const { sessions, activeProjectId } = useApp();
	return useMemo(
		() => (activeProjectId === "all" ? sessions : sessions.filter((s) => s.projectId === activeProjectId)),
		[sessions, activeProjectId],
	);
}

export function usePRs() {
	const sessions = useVisibleSessions();
	return useMemo(() => collectPRs(sessions), [sessions]);
}

export function AppProvider({ children }: { children: ReactNode }) {
	const [config, setConfig] = useState<ServerConfig | null>(null);
	const [projects, setProjects] = useState<ProjectInfo[]>([]);
	const [sessions, setSessions] = useState<DashboardSession[]>([]);
	const [orchestrators, setOrchestrators] = useState<OrchestratorLink[]>([]);
	const [orchestratorId, setOrchestratorId] = useState<string | null>(null);
	const [stats, setStats] = useState<DashboardStats>({});
	const [activeProjectId, setActiveProjectId] = useState<string>("all");
	const [connection, setConnection] = useState<ConnStatus>("closed");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const cfgRef = useRef<ServerConfig | null>(null);

	useEffect(() => {
		AsyncStorage.getItem(ACTIVE_PROJECT_KEY).then((v) => {
			if (v) setActiveProjectId(v);
		});
	}, []);

	const reloadConfig = useCallback(async () => {
		const c = await loadConfig();
		cfgRef.current = c;
		setConfig(c);
	}, []);

	useEffect(() => {
		reloadConfig();
	}, [reloadConfig]);

	const fetchAll = useCallback(async () => {
		const c = cfgRef.current;
		if (!c || !isConfigured(c)) {
			setConnection("closed");
			setLoading(false);
			return;
		}
		try {
			const [projs, sess] = await Promise.all([
				getProjects(c).catch(() => [] as ProjectInfo[]),
				getSessions(c, "all"),
			]);
			setProjects(projs);
			setSessions(sess.sessions);
			setOrchestrators(sess.orchestrators);
			setOrchestratorId(sess.orchestratorId);
			setStats(sess.stats);
			setError(null);
			setConnection("open");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
			setConnection("closed");
		} finally {
			setLoading(false);
		}
	}, []);

	// (Re)start the REST poll whenever the config changes.
	useEffect(() => {
		if (!config || !isConfigured(config)) {
			setConnection("closed");
			setLoading(false);
			return;
		}
		setLoading(true);
		setConnection("connecting");
		fetchAll();
		const poll = setInterval(fetchAll, POLL_INTERVAL_MS);
		return () => clearInterval(poll);
	}, [config, fetchAll]);

	const setActiveProject = useCallback((id: string) => {
		setActiveProjectId(id);
		AsyncStorage.setItem(ACTIVE_PROJECT_KEY, id).catch(() => {});
	}, []);

	const targetProject = useCallback((): string | null => {
		if (activeProjectId !== "all") return activeProjectId;
		if (projects.length === 1) return projects[0].id;
		return null;
	}, [activeProjectId, projects]);

	const spawn = useCallback(
		async (prompt?: string, projectId?: string) => {
			const c = cfgRef.current;
			const proj = projectId ?? targetProject();
			if (!c || !proj) throw new Error("Pick a project first");
			await spawnSession(c, { projectId: proj, prompt });
			await fetchAll();
		},
		[targetProject, fetchAll],
	);

	const launchConductor = useCallback(
		async (projectId: string, clean = false) => {
			const c = cfgRef.current!;
			const link = await apiLaunchOrchestrator(c, projectId, clean);
			await fetchAll();
			return link;
		},
		[fetchAll],
	);

	const merge = useCallback(
		async (pr: DashboardPR) => {
			await apiMergePR(cfgRef.current!, pr);
			await fetchAll();
		},
		[fetchAll],
	);

	const kill = useCallback(
		async (id: string) => {
			await killSession(cfgRef.current!, id);
			await fetchAll();
		},
		[fetchAll],
	);

	const restore = useCallback(
		async (id: string) => {
			await restoreSession(cfgRef.current!, id);
			await fetchAll();
		},
		[fetchAll],
	);

	const send = useCallback(async (id: string, message: string) => {
		await sendMessage(cfgRef.current!, id, message);
	}, []);

	const value = useMemo<AppState>(
		() => ({
			config,
			configured: !!config && isConfigured(config),
			projects,
			sessions,
			orchestrators,
			orchestratorId,
			stats,
			activeProjectId,
			connection,
			loading,
			error,
			reloadConfig,
			refresh: fetchAll,
			setActiveProject,
			spawn,
			launchConductor,
			merge,
			kill,
			restore,
			send,
		}),
		[
			config,
			projects,
			sessions,
			orchestrators,
			orchestratorId,
			stats,
			activeProjectId,
			connection,
			loading,
			error,
			reloadConfig,
			fetchAll,
			setActiveProject,
			spawn,
			launchConductor,
			merge,
			kill,
			restore,
			send,
		],
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

- [ ] **Step 8: Verify**

Run: `cd packages/mobile && npm run typecheck`
Expected: PASS (app/ files not yet created won't be referenced by lib/).

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/lib
git commit -m "feat(mobile): add REST client, theme, store, and UI primitives"
```

---

### Task 3: Routes and screens (`app/`)

**Files:**
- Create: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/prs.tsx`, `app/(tabs)/orchestrator.tsx`, `app/(tabs)/settings.tsx`, `app/spawn.tsx`
- Create: `app/session/[id].tsx` (STUB, full code below)

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: the running app with four tabs, spawn modal, and a session stub route `/session/[id]`.

- [ ] **Step 1: Port `app/_layout.tsx` verbatim** from `ref/app__layout.tsx` (no changes; the `session/[id]` Stack.Screen title/back stay).

- [ ] **Step 2: Port `app/(tabs)/_layout.tsx` verbatim** from `ref/app_(tabs)__layout.tsx` (tab order: index/prs/orchestrator/settings — matches screenshots).

- [ ] **Step 3: Port `app/(tabs)/index.tsx` verbatim** from `ref/app_(tabs)_index.tsx`.

- [ ] **Step 4: Port `app/(tabs)/prs.tsx` verbatim** from `ref/app_(tabs)_prs.tsx`.

- [ ] **Step 5: Port `app/(tabs)/orchestrator.tsx` verbatim** from `ref/app_(tabs)_orchestrator.tsx`.

- [ ] **Step 6: Port `app/(tabs)/settings.tsx` verbatim** from `ref/app_(tabs)_settings.tsx` (Host / API Port / Terminal Port / Use TLS / Test / Save / Projects — matches screenshot 5).

- [ ] **Step 7: Port `app/spawn.tsx` verbatim** from `ref/app_spawn.tsx`.

- [ ] **Step 8: Create `app/session/[id].tsx` (STUB).** Matches screenshot 3's chrome minus the live terminal: status pill, session title in the header, a "coming soon" placeholder, and a working Kill.

```tsx
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { sessionTitle } from "../../lib/api";
import { useApp } from "../../lib/store";
import { statusVisual, theme } from "../../lib/theme";
import { Button, Dot } from "../../lib/ui";

export default function SessionScreen() {
	const { id } = useLocalSearchParams<{ id: string; projectId?: string }>();
	const router = useRouter();
	const { sessions, kill } = useApp();
	const [busy, setBusy] = useState(false);

	const session = sessions.find((s) => s.id === id);
	const v = statusVisual(session?.status);
	const title = session ? sessionTitle(session) : (id ?? "Session");

	const onKill = () => {
		if (!id) return;
		Alert.alert("Kill session?", `Terminate ${id}. This cannot be undone.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Kill",
				style: "destructive",
				onPress: async () => {
					setBusy(true);
					try {
						await kill(id);
						router.back();
					} catch (e) {
						Alert.alert("Kill failed", e instanceof Error ? e.message : "Unknown error");
						setBusy(false);
					}
				},
			},
		]);
	};

	return (
		<View style={styles.screen}>
			<Stack.Screen options={{ title }} />

			<View style={styles.statusRow}>
				<Dot color={v.color} breathing={v.breathing} size={8} />
				<Text style={[styles.status, { color: v.color }]}>{v.label}</Text>
				<View style={{ flex: 1 }} />
				<Text style={styles.id}>{id}</Text>
			</View>

			<View style={styles.placeholder}>
				<View style={styles.icon}>
					<Feather name="terminal" size={26} color={theme.textTertiary} />
				</View>
				<Text style={styles.phTitle}>Live terminal coming soon</Text>
				<Text style={styles.phMsg}>
					The interactive terminal isn't available on mobile yet. You can still kill this session below.
				</Text>
			</View>

			<View style={styles.actions}>
				<Button title="Kill session" variant="danger" icon="x" loading={busy} onPress={onKill} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: theme.bgBase, padding: 16 },
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: theme.borderSubtle,
	},
	status: { fontSize: 13, fontWeight: "600" },
	id: { color: theme.textTertiary, fontSize: 12, fontFamily: theme.fontMono },
	placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
	icon: {
		width: 64,
		height: 64,
		borderRadius: 18,
		backgroundColor: theme.bgElevated,
		borderWidth: 1,
		borderColor: theme.borderSubtle,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 6,
	},
	phTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700", textAlign: "center" },
	phMsg: {
		color: theme.textSecondary,
		fontSize: 13,
		lineHeight: 20,
		textAlign: "center",
		maxWidth: 300,
	},
	actions: { paddingBottom: 8 },
});
```

- [ ] **Step 9: Verify**

Run: `cd packages/mobile && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/mobile/app
git commit -m "feat(mobile): add expo-router tabs, spawn, and session stub"
```

---

### Task 4: README and final verification

**Files:**
- Overwrite: `packages/mobile/README.md`

- [ ] **Step 1: Overwrite `packages/mobile/README.md`**

````markdown
# Agent Orchestrator — Mobile

Expo (expo-router) mobile supervisor for Agent Orchestrator. Four tabs — Kanban,
PRs, Orchestrator, Settings — plus a spawn flow and a session screen. It talks to
your AO server's HTTP API over your LAN or Tailscale.

## Run

```bash
cd packages/mobile
npm install        # from repo root the first time: `npm install`
npm start          # then press i (iOS), a (Android), or scan the QR in Expo Go
```

## Connect

Open **Settings** and set:

- **Host** — your PC's Tailscale name / `100.x` address, or its LAN IP on the same Wi-Fi.
- **API Port** — the AO server HTTP API port.
- **Terminal Port** — reserved for the live terminal (a follow-up); safe to leave default.
- **Use TLS** — on only if AO is served over HTTPS (e.g. a Tailscale funnel).

Tap **Test connection**, then **Save**.

## Status

The live in-app terminal is not implemented yet — the session screen shows session
status and a Kill action with a "coming soon" placeholder. Everything else
(board, PRs, orchestrators, spawn, settings) is live against the AO API.

## Verify

```bash
npm run typecheck   # tsc --noEmit
```
````

- [ ] **Step 2: Root build**

Run: `npm run build:mobile`
Expected: PASS.

- [ ] **Step 3: Typecheck**

Run: `cd packages/mobile && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Git status**

Run: `git status --porcelain`
Expected: no `node_modules`, `.expo`, or `expo-env.d.ts` entries; only intended files.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/README.md
git commit -m "docs(mobile): document expo-router app and deferred terminal"
```

---

## Self-Review

- **Spec coverage:** expo-router port (§Approach), four tabs + spawn (Task 3), Kanban stats/chips/sections/FAB (index port), PRs filters/merge (prs port), orchestrator cards (orchestrator port), Settings host/ports/TLS/test/projects (settings port), deferred terminal stub with Kill (Task 3 Step 8), REST-only store (Task 2 Step 7), assets + gitignore + package config (Task 1), verification + README (Task 4). All spec sections map to a task.
- **Placeholder scan:** none — every file is either a verbatim port from a named `ref/` file or has full code inline.
- **Type consistency:** `connection` is `ConnStatus` in the adapted store; `ConnectionPill status={connection}` accepts a string; screens consume `useApp`/`useVisibleSessions`/`usePRs` and the exact action names (`refresh`, `spawn`, `merge`, `kill`, `launchConductor`) defined in Task 2. The session stub uses `sessions`, `kill`, `sessionTitle`, `statusVisual`, `Dot`, `Button` — all exported by Task 2 files.
- **Scope boundary:** no `lib/mux.ts`, no webview/xterm deps, terminal stubbed — matches the "defer terminal" decision.
