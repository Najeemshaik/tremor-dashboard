# Tremor Dashboard

> Clinical tremor analysis dashboard for Parkinson's Disease monitoring — built with vanilla TypeScript, Web Bluetooth, and Supabase.

A browser-native application that connects to a wearable BLE sensor, streams accelerometer data in real time, and provides clinical-grade analysis tools for tremor assessment and stimulation parameter control.

---

## Features

| | |
|---|---|
| **Live Waveform** | Real-time signal chart with configurable window, gain, freeze, and snapshot overlay |
| **FFT Spectrum** | Frequency-domain view with freezable display |
| **Clinical Metrics** | Dominant frequency, RMS, UPDRS estimate, SNR, peak-to-peak, and more |
| **Parameter Control** | Frequency, amplitude, noise tuning with dirty-state tracking and BLE send |
| **Profiles** | Save, load, import, and export parameter presets |
| **Sequences** | Scripted multi-step parameter programs with timed playback |
| **Session Recording** | Log telemetry, view summaries, export as CSV or JSON |
| **Simulation Mode** | Mock BLE connection and synthetic signal for offline demos |
| **Supabase Sync** | Optional cloud persistence for profiles, sequences, and sessions |
| **Theming** | Light/dark mode and high-contrast accessibility mode |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.4 |
| Runtime | Browser — ESM modules, no bundler |
| Bluetooth | Web Bluetooth API |
| Local DB | `sql.js` (SQLite → WASM) |
| Remote DB | Supabase REST API |
| Tests | Vitest |
| Build | `tsc` → `dist/` |

---

## Prerequisites

- Node.js 18+ and npm
- Chrome or Edge (desktop) for Web Bluetooth / Web Serial
- Secure context for hardware APIs: `https://` or `http://localhost`

---

## Quick Start

```bash
# 1. Install dependencies (also copies sql-wasm.wasm into lib/)
npm install

# 2. Compile
npm run build

# 3. Serve (Bluetooth requires a secure context)
python3 -m http.server 5173
# or: npx serve . -l 5173
```

Open `http://localhost:5173`.

> Serve the project root (not `dist/`). `index.html` loads `styles.css`, `lib/sql-wasm.wasm`, and `dist/src/main.js` via relative paths.

---

## Scripts

```bash
npm run build          # Compile TypeScript to dist/
npm run build:watch    # Recompile on changes
npm test               # Run Vitest (single pass)
npm run test:watch     # Vitest in watch mode
npm run test:vm        # Build + run viewmodel harness in Node
```

---

## Development Workflow

```bash
# terminal 1: rebuild TS continuously
npm run build:watch

# terminal 2: serve project root
python3 -m http.server 5173
# or: npx serve . -l 5173
```

Open `http://localhost:5173` and hard-refresh after structural HTML/CSS changes.

This project runs as browser ESM without a bundler:
- Runtime entry: `index.html`
- Module entry: `dist/src/main.js`

---

## Supabase Setup

Supabase is the primary backend for persisting profiles, sequences, and sessions.

### 1. Create the table

Run in the **Supabase SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS public.app_state (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. (Optional) Seed initial data

A ready-to-run seed file is provided at [`supabase/seed.sql`](supabase/seed.sql).
It inserts the default profiles, sequences, and sessions using an upsert — safe to re-run.

```bash
# Paste the contents of supabase/seed.sql into the Supabase SQL Editor and run it.
```

### 3. Load config in the app

Create a `supabase.config.json` file (never commit this):

```json
{ "url": "https://your-project.supabase.co", "anonKey": "eyJ..." }
```

In the app: **Settings → Supabase Storage → Load Config File**, then select the file.

> The config is cached in the browser's Origin Private File System (OPFS) so you only need to load it once.
> Do not commit `supabase.config.json` or hard-code keys in source control.

### Security Notes

- Never commit Supabase keys or `supabase.config.json`.
- Treat leaked anon keys as compromised and rotate them in Supabase.
- Keep table access constrained with RLS/policies appropriate for your deployment model.
- Prefer HTTPS in production so browser and API traffic stay encrypted.

### First Launch Behavior

- On startup, if no stored Supabase config exists, the app shows a blocking config overlay.
- After selecting a valid config file once, the file handle is cached and reused on future loads.
- Local SQLite is still used for fast local persistence, then synced to Supabase when configured.

---

## Connection Modes

| Mode | Description |
|---|---|
| **Bluetooth** | Web Bluetooth connection to a BLE wearable (requires HTTPS or localhost, Chrome/Edge) |
| **Mock** | Simulated connection with synthetic sine-wave signal — no hardware needed |
| **Cable** | Reserved for future wired transport |

The mock signal only runs when explicitly connected in **Mock** mode — it does not auto-play on launch.

---

## Current Limitations

- First launch blocks on Supabase config file selection when no stored config handle exists.
- BLE telemetry currently maps to scalar `sample` / `samples` for waveform input; full 6-axis BLE IMU mapping requires parser and routing extensions.
- Automated tests are unit-level only; there is no browser E2E harness for UI workflows.
- Browser hardware support is best on Chrome/Edge desktop for Web Bluetooth/Web Serial APIs.

---

## Project Structure

```
src/
  main.ts              Entry point
  bootstrap.ts         DOMContentLoaded setup
  compositionRoot.ts   Wires all services, viewmodels, and views
  app.ts               Event bindings, subscriptions, config flow
  state/
    store.ts           Reactive store (subscribe / update / subscribeSelector)
    types.ts           All TypeScript state types
    initialState.ts    Zero-value starting state
  services/
    bluetooth/         BLE transport, telemetry parsing, latency test
    database/          sql.js wrapper, schema, migrations, repositories
    storage/           Supabase REST client, persistence queue
    mock/              Simulated BLE connection and telemetry
    export/            Session CSV/JSON export
  viewmodels/          Business logic; reads store, dispatches updates
  views/               DOM rendering; subscribes to store
  ui/                  Element binding helpers, param UI
  core/                Shared utilities (math, format, id, constants)
  tests/               Vitest unit tests
supabase/
  seed.sql             Initial data for Supabase (profiles, sequences, sessions)
dist/                  Compiled output (generated by tsc)
lib/                   sql-wasm.wasm (copied on npm install)
```

---

## Release / Deploy Notes

Deploy these artifacts together:
- `index.html`
- `styles.css`
- `dist/`
- `lib/sql-wasm.wasm`

Hosting requirements:
- Serve over HTTPS in production.
- Preserve relative paths used by `index.html` (`dist/src/main.js` and `lib/sql-wasm.wasm`).
- Use `http://localhost` for local hardware testing.

---

## Additional Docs

- [`INTEGRATION.md`](INTEGRATION.md): firmware/transport contract for BLE + serial
- [`BLUETOOTH_SETUP.md`](BLUETOOTH_SETUP.md): browser/device setup checklist

---

## Testing Scope

Current automated coverage:
- Store behavior and selector notifications
- Storage payload normalization + persistence queue behavior
- Profiles viewmodel logic

Current gaps:
- No automated DOM/UI flow tests
- No automated Bluetooth/Serial integration tests against real hardware

Run tests with:

```bash
npm test
```

---

## Architecture

The app follows a **custom MVC pattern with an observer store** — no framework, no dependency injection container.

```
Views ──subscribe──► Store ◄──update── ViewModels
                       │
                  Services (BLE, DB, Storage)
```

All state mutations go through `store.update()`. Direct property assignment bypasses `notify()` and views will not re-render.

---

## Troubleshooting

**Bluetooth not working**
- Requires Chrome or Edge on desktop.
- Must be served over `https://` or `http://localhost`.
- Confirm your BLE UUIDs match `src/services/bluetooth/bleConfig.ts`.

**Data not loading**
- Check that your `supabase.config.json` URL and anon key are correct.
- Confirm the `app_state` table exists in your Supabase project.
- If local SQLite is corrupt, clear `localStorage["tremor-db"]` and reload.

**WASM error on load**
- Ensure `lib/sql-wasm.wasm` is being served. Run `npm install` to regenerate it.
