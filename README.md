# Tremor Dashboard

Clinical-style dashboard for monitoring tremor telemetry, tuning stimulation parameters, and managing profiles, sequences, and recorded sessions. The app is a static TypeScript build that runs fully in the browser with optional Web Bluetooth support and a local, in-browser SQLite database (via `sql.js`).

## Features
- Live connection status, latency, and packet error rate (PER) monitoring.
- Real-time signal visualization with configurable windowing, gain, freeze, and snapshot.
- Clinical metrics panel derived from incoming telemetry.
- Parameter control with dirty-state tracking and last-sent status.
- Profiles for saving and quickly loading parameter presets.
- Sequences for scripted parameter steps with playback control.
- Session logging with export options.
- Light/dark themes and high-contrast mode.
- Mock connection and telemetry for offline demos.

## Tech Stack
- TypeScript (no bundler; `tsc` builds to `dist/`).
- Static HTML/CSS UI.
- `sql.js` (SQLite compiled to WebAssembly) for in-browser persistence.
- Vitest for unit tests.

## Quick Start
1. Install dependencies.
   ```sh
   npm install
   ```
2. Build the app.
   ```sh
   npm run build
   ```
3. Serve the site (recommended so Web Bluetooth works on `localhost`).
   ```sh
   python3 -m http.server 5173
   ```
4. Open `http://localhost:5173`.

Note: `npm install` copies `sql.js` WASM into `lib/` via `postinstall`. Make sure `lib/sql-wasm.wasm` is served alongside `index.html`.

## Scripts
- `npm run build`: Compile TypeScript into `dist/`.
- `npm run build:watch`: Rebuild on changes.
- `npm test`: Run Vitest in CI mode.
- `npm run test:watch`: Watch tests.
- `npm run test:vm`: Build and run the viewmodel harness with Node.

## Usage Guide

### Connection Modes
- `Mock`: Simulated connect, latency, and PER updates for demos.
- `Bluetooth`: Web Bluetooth connection to a BLE device.
- `Cable`: Placeholder mode in state; current UI uses mock or Bluetooth.

### Parameters
- Adjust frequency, amplitude, noise, and enabled state.
- Dirty-state indicator shows when local values differ from last sent.
- Use `Send` to transmit to the device and `Stop` to halt stimulation.

### Profiles
- Save the current parameter set as a named profile.
- Quickly load profiles into the parameter panel.
- Import/export profiles for sharing.

### Sequences
- Create sequences of timed parameter steps.
- Play sequences to apply steps over time.
- Sync sequences to the active device when connected.

### Sessions
- Start/stop logging to capture telemetry samples.
- View session summaries and delete old sessions.
- Export sessions as CSV or JSON.

### Visualization
- Live waveform chart with configurable window length and gain.
- Spectrum view with freeze and snapshot overlays.
- Clinical metrics computed from the current buffer.

## Bluetooth Setup
For full BLE setup, UUID configuration, and troubleshooting, see `BLUETOOTH_SETUP.md`.

## Data Persistence
- Uses `sql.js` to store profiles, sequences, and sessions in a local SQLite database.
- The database is serialized into `localStorage` under `tremor-db`.
- Schema definition lives in `schema.sql`.

## Project Structure

**Architecture Overview**
- `UI (Views + UI helpers)`: Owns DOM rendering and user interactions. Views are thin and delegate behavior to viewmodels.
- `ViewModels`: Orchestrate user intent, update state, and call services. They are the main “application layer.”
- `State + Store`: Central app state with typed models, selectors, and subscriptions.
- `Services`: Infrastructure and side effects (Bluetooth, database, exports, storage, mock data).
- `Composition Root`: Wires dependencies and instantiates the app graph.
- `Entry Points`: Minimal bootstrapping to start the app.

**Key Files**
- `src/bootstrap.ts`: DOM-ready entry point; creates dependencies and starts the app.
- `src/app.ts`: App initialization, subscriptions, and event wiring.
- `src/compositionRoot.ts`: Dependency injection and wiring of services, views, and viewmodels.
- `styles.css`: Global styles and theming.

**Folder Structure and Responsibilities**
- `src/core/`: Core utilities and domain logic (constants, math, helpers).
- `src/state/`: App state types, store implementation, initial state, and seed data.
- `src/services/`: Infrastructure layer.
- `src/services/bluetooth/`: BLE config, transport, telemetry parsing, latency/perf monitoring.
- `src/services/database/`: SQLite schema, migrations, repositories, and persistence.
- `src/services/export/`: CSV/JSON export utilities for sessions.
- `src/services/mock/`: Mock connection and telemetry for offline demos/tests.
- `src/services/storage/`: Local storage helpers for lightweight persistence.
- `src/ui/`: Element bindings and UI helpers (e.g., param UI updates).
- `src/views/`: DOM rendering and interaction primitives for each major screen.
- `src/views/visualization/`: Chart, spectrum, and metrics rendering.
- `src/viewmodels/`: Business logic for connection, params, profiles, sequences, sessions, and visualization.
- `src/tests/`: Unit tests plus the viewmodel harness runner.
- `dist/`: Compiled output from `tsc`.
- `schema.sql`: SQLite schema reference for the in-browser database.

## Testing
- Run unit tests with `npm test`.
- The viewmodel harness runs with `npm run test:vm` after a build.

## Troubleshooting
- Web Bluetooth requires HTTPS or `http://localhost` in Chrome/Edge.
- If the UI loads but data does not, confirm your BLE UUIDs match `src/services/bluetooth/bleConfig.ts`.
- If the database fails to load, clear the `tremor-db` key in `localStorage`.

## Supabase Storage (Optional)
You can sync `profiles`, `sequences`, and `sessions` to Supabase.

1) Create a table in Supabase SQL editor:
```sql
create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

2) In the app, open **Settings > Supabase Storage** and load your config JSON file.

Notes:
- Supabase is treated as the primary backend when configured.
- If Supabase is empty on first connect, the app auto-bootstraps it from local data.
- No auth flow is implemented yet; intended for local/testing usage.
