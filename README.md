# Tremor Dashboard

## Prerequisites
- Node.js (LTS recommended)
- npm

## Install
```sh
npm install
```

## Run the website
This project builds TypeScript to `dist/` and the site is served as static files.

1) Build the app:
```sh
npm run build
```

2) Open `index.html` in your browser.

Optional: run a simple local server (recommended for consistent module loading):
```sh
python3 -m http.server 5173
```
Then visit `http://localhost:5173`.

## Development workflow
- Rebuild on changes:
```sh
npm run build:watch
```

## Tests
```sh
npm test
```

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

2) In the app, open **Settings > Supabase Storage** and fill:
- Supabase URL (for example `https://<project-ref>.supabase.co`)
- Anon key
- Table name (`app_state` by default)

3) Click **Save Supabase Config**.

Notes:
- Supabase is treated as the primary backend when configured.
- If Supabase is empty on first connect, the app auto-bootstraps it from local/folder data.
- Browser storage is always kept as a local mirror for offline fallback.
- Folder storage remains optional as an additional local backup path.
- No auth flow is implemented yet; this is intended for local/testing usage.
