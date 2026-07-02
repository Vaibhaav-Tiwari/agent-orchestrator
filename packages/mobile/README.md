# Agent Orchestrator — Mobile

Expo (expo-router) mobile supervisor for Agent Orchestrator. Four tabs — Kanban,
PRs, Orchestrator, Settings — plus a spawn flow and a session screen. It talks to
your AO server's HTTP API over your LAN or Tailscale.

## Run

```bash
cd packages/mobile
npm install        # from the repo root the first time: `npm install`
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
