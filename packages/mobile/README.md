# Agent Orchestrator Mobile

Expo mobile supervisor for Agent Orchestrator.

## Run

```bash
cd packages/mobile
npm install
npm run start
```

## Daemon Connection

The app connects to a daemon URL configured in Settings. A physical phone cannot use the desktop daemon's `127.0.0.1`, so use a reachable LAN address such as:

```text
http://192.168.1.20:34115
```

Keep the daemon loopback-only unless a separate, intentional remote-access mode is added to the backend.
