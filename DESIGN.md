# Bug Garden — Game Design Document

A cozy, web-based **gachapon bug-collecting game**. You tend a garden, harvest fruit, and feed
that fruit into a capsule machine to summon real insect species. Every bug is a real species
with its description, photo and conservation status pulled from Wikipedia.

- **Platform:** browser (desktop + mobile widths)
- **Stack:** React 18 + TypeScript, built with Vite. No backend; progress is saved in `localStorage`.
- **Data:** a build-time script fetches species data from Wikipedia and writes a static JSON file
  that ships with the game, so the game works offline and never hammers Wikipedia at runtime.

---

## 1. Core loop

```
 plant seeds ──► tend (water / pull weeds / fertilize) ──► harvest fruit
      ▲                                                   │
      │                                                   ▼
 buy / find seeds ◄── coins ◄── release duplicates ◄── summon bugs (gachapon)
                                                          │
                                                          ▼
                                                 fill the Bugdex
```

1. **Garden** — plant seeds in plots and keep the plants healthy until they bear fruit.
2. **Harvest** — ripe plants give fruit (and sometimes seeds). Better care gives better fruit.
3. **Summon** — put a fruit in the capsule machine. The fruit decides *which bugs can appear*
   and *how lucky the pull is*.
4. **Collect** — new species are added to the Bugdex. Duplicates can be released for coins.
5. **Grow** — coins buy seeds, fertilizer and more garden plots.

The long-term goal is completing the Bugdex: every species, every order.

---

## 2. Bugs

### 2.1 Identity
Every bug is identified **to species** (binomial name, e.g. *Dryococelus australis*), with:

| Field              | Source                                              |
|--------------------|-----------------------------------------------------|
| Scientific name    | curated seed list                                   |
| Common name        | curated seed list, falling back to Wikipedia title  |
| Order              | curated seed list (e.g. Coleoptera, Odonata)        |
| Conservation status| Wikipedia taxobox (`status =` / `status_system =`)   |
| Description        | Wikipedia page summary (lead extract)               |
| Image              | Wikipedia page thumbnail                            |
| Link               | Wikipedia article URL                               |

### 2.2 Rarity = conservation status
Rarity is derived **only** from the conservation status in the species' Wikipedia taxobox.
Rarer in the wild → rarer in the machine.

| Rarity        | Statuses                                              | Base weight |
|---------------|-------------------------------------------------------|-------------|
| Common        | Not Evaluated / no status, Least Concern, NatureServe G4–G5 | 62    |
| Uncommon      | Near Threatened, Data Deficient, LR/cd, LR/nt, G3?    | 22          |
| Rare          | Vulnerable, NatureServe G3                            | 10          |
| Epic          | Endangered, NatureServe G2                            | 4.5         |
| Legendary     | Critically Endangered, NatureServe G1                 | 1.3         |
| Mythic        | Extinct, Extinct in the Wild, NatureServe GX/GH        | 0.2         |

Extinct species are "Mythic": the only way to ever see them now is in the archive.

### 2.3 Orders in the game
Coleoptera, Lepidoptera, Odonata, Hymenoptera, Hemiptera, Orthoptera, Phasmatodea,
Mantodea, Diptera, Blattodea, Neuroptera, Ephemeroptera. Roughly 10–20 species each.

---

## 3. Fruits & plants

Each plant grows one fruit. Fruits are real fruit; the link between fruit and bug is light-hearted,
sometimes meaningful (dragonfruit → dragonflies, figs → fig wasps, grapes → grape phylloxera,
kiwifruit → New Zealand wētā), sometimes just fun (raspberries → beetles).

### 3.1 Fruit effects
- **Wild fruits** — summon from *every* order. Some add **luck** (shift odds toward rarer tiers).
- **Order fruits** — summon only from *one* order.

| Fruit        | Effect                      | Plant            |
|--------------|-----------------------------|------------------|
| Apple        | Any order                   | Apple tree       |
| Strawberry   | Any order, luck +0.25       | Strawberry patch |
| Mango        | Any order, luck +0.75       | Mango tree       |
| Starfruit    | Any order, luck +1.5        | Carambola tree   |
| Raspberry    | Coleoptera (beetles)        | Raspberry cane   |
| Passionfruit | Lepidoptera (butterflies & moths) | Passion vine |
| Dragonfruit  | Odonata (dragonflies & damselflies) | Pitaya cactus |
| Fig          | Hymenoptera (bees, wasps, ants) | Fig tree     |
| Grapes       | Hemiptera (true bugs)       | Grapevine        |
| Kiwifruit    | Orthoptera (crickets, grasshoppers, wētā) | Kiwi vine |
| Banana       | Phasmatodea (stick & leaf insects) | Banana plant |
| Pear         | Mantodea (mantises)         | Pear tree        |
| Blueberry    | Diptera (true flies)        | Blueberry bush   |
| Coconut      | Blattodea (cockroaches & termites) | Coconut palm |
| Cherry       | Neuroptera (lacewings & antlions) | Cherry tree  |
| Peach        | Ephemeroptera (mayflies)    | Peach tree       |

### 3.2 Seed scarcity follows bug rarity
**Orders with more rare bugs have less common seeds.** This is computed from the data, not
hand-tuned: for each order we take the share of its species that are Rare or rarer
(Vulnerable, Endangered, Critically Endangered, Extinct). Orders are ranked by that share and
split into thirds:

| Seed tier | Orders                         | Shop appearance | Price | Seed drop on harvest |
|-----------|--------------------------------|-----------------|-------|----------------------|
| Common    | lowest third of rare-share     | often           | low   | 60%                  |
| Uncommon  | middle third                   | sometimes       | mid   | 40%                  |
| Rare      | highest third                  | seldom          | high  | 20%                  |

Wild-fruit seeds are fixed: Apple/Strawberry common, Mango uncommon, Starfruit rare.

### 3.3 Fruit quality
Care is measured continuously while a plant grows: the fraction of time it was **watered and
weed-free**. At harvest:

| Quality  | Requirement                               | Luck bonus |
|----------|-------------------------------------------|------------|
| Normal   | —                                         | +0         |
| Fine     | care ≥ 60%                                | +0.25      |
| Perfect  | care ≥ 90% **and** fertilized this cycle  | +0.6       |

---

## 4. Garden

### 4.1 Plots
The garden starts with 6 plots (more can be bought, up to 16). A plot holds at most one plant
and up to 3 weeds.

### 4.2 Actions
| Action     | Effect |
|------------|--------|
| **Plant**  | Uses a seed from the seed pouch on an empty, weed-free plot. |
| **Water**  | Refills the plot's moisture to 100%. Free and unlimited, but moisture drains over ~70 s. Dry plants grow at 15% speed. |
| **Weed**   | Click and drag a weed in the plot to pull it out by hand (there is no weed tool). Keyboard: Tab to a weed and press Enter; each weed takes 1–4 presses, with "keep pulling" updates until it comes out. Each weed slows growth by 25%. Weeds give **compost**, and occasionally a random **wild seed** turns up in the soil. |
| **Fertilize** | Uses 1 fertilizer: +70% growth speed for 90 s and qualifies the fruit for *Perfect*. 3 compost → 1 fertilizer. |
| **Harvest** | Picks ripe fruit (2–3 per harvest, +1 if fertilized). Plants have a number of harvests (1–3) before they're spent; after a harvest they go back to flowering. Chance of a seed drop. |

### 4.3 Growth
Growth runs in real time (1 s ticks) and is also simulated for time spent away (capped at 2 h).
Stages: **Seed → Sprout → Flowering → Ripe**. Growth time depends on the plant (45 s – 4 min),
with rarer plants taking longer.

```
growth/sec = 1/growTime × (moist ? 1 : 0.15) × (1 − 0.25·weeds) × (fertilized ? 1.7 : 1)
```

Weeds sprout on any plot at random (on average once every ~80 s per plot, max 3).

---

## 5. Summoning (the capsule machine)

1. Pick a fruit from the basket and drop it in.
2. Turn the crank → a capsule drops, colored by rarity → it pops open to reveal the bug.

### 5.1 Odds
```
luck   = fruit luck + quality bonus
w[t]   = baseWeight[t] × (1 + luck × t)        t = tier index (Common = 0 … Mythic = 5)
```
Tiers with no species in the fruit's pool are removed and the rest renormalised. Within a tier,
species are chosen uniformly, with a 2× weight on species you don't own yet (gentle
duplicate protection).

The machine shows the exact odds for the selected fruit before you summon.

### 5.2 Pity
Every summon without an Epic-or-better bug adds 1 to the **pity meter**. At 40, the next
summon is guaranteed Epic or better (or the best tier the fruit's pool has). The meter resets
when an Epic+ bug appears.

---

## 6. Economy

| Source                      | Coins |
|-----------------------------|-------|
| New species discovered      | 5 / 10 / 20 / 40 / 80 / 150 by tier |
| Releasing a duplicate       | 2 / 4 / 8 / 16 / 32 / 60 by tier |
| Selling a fruit             | 1–6 depending on fruit tier |

| Sink                 | Cost |
|----------------------|------|
| Seeds                | 5 (common) / 12 (uncommon) / 30 (rare) |
| Fertilizer           | 8 |
| New plot             | 40, +20 per plot owned beyond 6 |
| Shop refresh         | 5 (free refresh every 3 min) |

**Shop:** always sells Apple and Strawberry seeds and fertilizer, plus 4 rotating slots drawn
by seed tier (Common 60%, Uncommon 30%, Rare 10%).

**Starting kit:** 30 coins, 3 Apple, 3 Strawberry, 2 Raspberry seeds, 2 fertilizer.

---

## 7. Screens

| Screen        | Contents |
|---------------|----------|
| **Garden**    | Plot grid. Select a plot to see moisture, weeds, growth, care; action buttons. Seed pouch to plant. "Water all" convenience. |
| **Summon**    | Capsule machine, fruit basket with effects and odds table, pity meter, reveal animation. |
| **Bugdex**    | All species as cards (silhouettes for undiscovered), filter by order/rarity/owned, progress per order. Detail view with Wikipedia photo, extract, status, owned count, release button, link to article. |
| **Market**    | Buy seeds, fertilizer, plots; sell fruit; compost → fertilizer. |

A top bar shows coins, fertilizer, compost and Bugdex progress on every screen.

---

## 8. Persistence
State is saved to `localStorage` (`bug-garden-save-v1`) every few seconds and on page hide.
A save includes a version number; an incompatible version starts a fresh game. A "Reset game"
option lives in the Market screen.

---

## 9. Data pipeline
`scripts/fetch-bugs.mjs`:
1. Reads the curated species list (`scripts/species.mjs`: scientific name, common name, order).
2. For each species, calls the Wikipedia REST summary endpoint (title, extract, thumbnail, URL)
   and the action API for the article wikitext (following redirects).
3. Parses the taxobox `status` / `status_system` to a normalised status code.
4. Writes `src/data/bugs.json`. Species whose article can't be found are skipped and reported.

Run with `npm run fetch-bugs`. The generated JSON is committed, so the game builds offline.
Text and images are from Wikipedia under CC BY-SA; the Bugdex credits and links each article.

---

## 10. Out of scope (v1)
Accounts / cloud saves, trading, sound, seasons and weather, bug "habitats" in the garden.
These are natural next steps.
