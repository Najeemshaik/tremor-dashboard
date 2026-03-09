# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keeping This File Updated:** Whenever a new feature, service, route, or architectural change is added,
> update this file to reflect it. This is the source of truth for future Claude instances.

---

## Project Overview

**Tremor Dashboard** is a clinical tremor analysis web app for Parkinson's Disease monitoring. It connects
to a wearable Bluetooth sensor, streams accelerometer data in real time, and provides:

- Live waveform and FFT spectrum visualization
- Clinical metric computation (dominant frequency, RMS, UPDRS estimate, SNR, etc.)
- Session recording and storage (SQLite via sql.js, synced to Supabase)
- Stimulation parameter control (frequency, amplitude, noise) sent over BLE GATT

There is **no frontend framework**. The UI is vanilla TypeScript with direct DOM manipulation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.4 |
| Runtime | Browser (ESM modules, no bundler) |
| Bluetooth | Web Bluetooth API (`navigator.bluetooth`) |
| Database | sql.js (SQLite compiled to WASM) |
| Remote storage | Supabase REST API (credentials loaded at runtime from a JSON file) |
| Tests | Vitest |
| Build | `tsc` only — outputs to `dist/` |

---

## Architecture

The app follows a **custom MVC pattern with an Observer store**, assembled in a composition root. There is
no dependency injection framework.

```
src/
  main.ts              Entry point
  bootstrap.ts         DOMContentLoaded: creates deps, calls configureApp() + initApp()
  compositionRoot.ts   Wires all services, viewmodels, and views together
  app.ts               Top-level event binding, config overlay flow, store subscriptions
  state/
    store.ts           Reactive store (subscribe / update / subscribeSelector)
    types.ts           AppState and all sub-state types
    initialState.ts    Zero-value starting state
    seedData.ts        Default profiles, sequences, sessions
  services/
    bluetooth/         BLE transport, characteristic helpers, telemetry parsing
    database/          sql.js wrapper, schema, migrations, repositories
    storage/           Supabase REST client, persistence queue, storage service
    mock/              Simulated BLE connection for dev/testing without hardware
    export/            Session CSV/JSON export
  viewmodels/          Business logic; read from store, dispatch updates via store.update()
  views/               DOM rendering; subscribe to store or called by viewmodels
  ui/                  Element binding helpers, param UI, settings events
  core/                Shared utilities (math, format, id, observable, constants)
  tests/               Vitest unit tests
```

---

## Critical Patterns

### Store update pattern — ALWAYS use `store.update()`

All state mutations **must** go through `store.update()`. Direct property assignment bypasses `notify()`
and views will not re-render.

```typescript
// CORRECT
store.update((state) => {
  state.visualization.freeze = true;
});

// WRONG — views will not re-render
state.visualization.freeze = true;
```

### View subscription pattern

```typescript
store.subscribeSelector(
  (s) => s.visualization.freeze,
  (freeze) => myView.setFreezeState(freeze)
);
```

### Async BLE handlers

BLE event handlers that perform async cleanup (e.g., `stopNotifications`) must be declared `async` and
wrapped in try/catch — the GATT server may already be gone by the time the handler fires.

---

## Key Files

| File | Role |
|---|---|
| `src/app.ts` | Top-level setup, config overlay, all DOM event bindings |
| `src/compositionRoot.ts` | Wires all services/viewmodels/views |
| `src/state/store.ts` | Reactive store implementation |
| `src/state/types.ts` | All TypeScript state types |
| `src/services/bluetooth/bluetoothService.ts` | BLE connection, telemetry, latency test |
| `src/services/bluetooth/bleTransport.ts` | Low-level GATT connect/disconnect/write |
| `src/services/bluetooth/bleUtils.ts` | Telemetry parsing, type guards, encoding |
| `src/services/bluetooth/bleConfig.ts` | BLE UUIDs (serviceUUID, controlCharUUID, telemetryCharUUID) |
| `src/services/storage/supabaseStorageService.ts` | Supabase REST calls |
| `src/services/database/sqliteStorageService.ts` | sql.js persistence |
| `src/viewmodels/visualizationViewModel.ts` | Chart update loop, FFT, clinical metrics |
| `src/viewmodels/sessionsViewModel.ts` | Recording start/stop, session persistence |

---

## Development Commands

```bash
npm run build          # tsc compile to dist/
npm run build:watch    # tsc in watch mode
npm test               # vitest run (single pass)
npm run test:watch     # vitest in watch mode
```

Serve `dist/` with any static file server. Bluetooth requires a **secure context** (localhost or HTTPS).

---

## Supabase Configuration

Credentials are loaded at runtime from a local JSON file selected by the user via the browser file picker.
The file is cached in the Origin Private File System (OPFS). It is **never bundled**.

`supabase.config.json` is in `.gitignore` — never commit it.

Expected shape:
```json
{ "url": "https://xxx.supabase.co", "anonKey": "eyJ..." }
```

---

## Current Branch

Active branch: `codex/backend`
Main branch: `main`
