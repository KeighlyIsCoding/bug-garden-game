# 🐞 Bug Garden

A cozy gachapon bug-collecting game. Tend a garden, harvest fruit, and feed it to a capsule
machine to summon **real insect species**. Each one has its photo, description and conservation
status from Wikipedia. Rarity comes from that conservation status: extinct species are Mythic.

See [DESIGN.md](DESIGN.md) for the full game design.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Scripts

| Command              | What it does |
|----------------------|--------------|
| `npm run dev`        | Start the dev server |
| `npm run build`      | Type-check and build to `dist/` |
| `npm test`           | Run the game-logic tests (Vitest) |
| `npm run fetch-bugs` | Re-fetch species data from Wikipedia into `src/data/bugs.json` |

## Project layout

```
scripts/species.mjs     curated species list (scientific name, common name, order)
scripts/fetch-bugs.mjs  pulls descriptions, images and taxobox status from Wikipedia
src/data/bugs.json      generated species data (committed, so the game works offline)
src/game/               pure game logic: bugs, plants, gacha odds, garden simulation, saves
src/components/         React screens: Garden, Summon, Bugdex, Market
```

To add a species, add it to `scripts/species.mjs` under its order and run `npm run fetch-bugs`.
Seed scarcity for each order is recomputed from the data automatically.

Species text and images come from Wikipedia under CC BY-SA.
