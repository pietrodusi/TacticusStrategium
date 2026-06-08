# Tacticus Strategium

A mobile-first web app to **plan Guild Raid boss fights** for Warhammer 40,000: Tacticus —
movement-wise. Pick a map, place your team, the boss, and summons on the hex grid, and chart
their positions across the six turns of a battle.

> Fan project. Not affiliated with or endorsed by Snowprint Studios. Game data via
> [TacticusDB](https://tacticusdb.com).

## Stack

React 19 · Vite · TypeScript · Zustand · TanStack Query · Tailwind CSS v4 · React Router (HashRouter).
Deployed as a static SPA to GitHub Pages.

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build → dist/
npm test           # unit tests (Vitest)
npm run lint       # ESLint
```

## Game data

Map/board geometry is bundled in `public/data/` and `public/images/maps/` (a snapshot of
TacticusDB). The volatile unit catalog (characters, bosses) is fetched live at runtime.

Refresh the bundled snapshot any time:

```bash
npm run dump:data            # all boards + map images + season index
npm run dump:data -- --no-images --skip-existing
```

The dump pipeline (master index → per-board tiles → map images) is documented in
`scripts/dump-tacticusdb.mjs`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub
Pages. The Vite `base` is `/TacticusStrategium/`.

## Roadmap

- Token placement + 6-turn movement planning on the grid
- Boss/character/summon pickers backed by live TacticusDB data
- Saved plans + accounts (Firebase) and shareable plan links
