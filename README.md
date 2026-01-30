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
