# Bug Garden — Game Design Document

A cozy, web-based **idle gardening + gachapon bug-collecting game**. You tend a garden, harvest
fruit, and feed that fruit into a capsule machine to summon real insect species. Every bug is a real
species with its description, photo and conservation status pulled from Wikipedia.

The garden is an idle / incremental game: plants are perennial, tools upgrade from one plot to big
squares and then to automation, land gets steadily more expensive, and **New Season** resets trade the
garden for permanent Golden Seeds so each run goes further. Automation keeps a garden producing on its
own; hands-on care (weeding, soaking, fertilizer) roughly doubles it and unlocks the best fruit.

- **Platform:** browser (desktop + mobile widths)
- **Stack:** React 18 + TypeScript, built with Vite. No backend; progress is saved in `localStorage`.
- **Data:** a build-time script fetches species data from Wikipedia and writes a static JSON file
  that ships with the game, so the game works offline and never hammers Wikipedia at runtime.

---

## 1. Core loop

```
 plant seeds ──► tend (water / weed / fertilize) ──► harvest fruit ──► sell ──► coins
      ▲                │  (upgrades automate it)          │                    │
      │                ▼                                  ▼                    ▼
 buy / find seeds   Shed upgrades ◄────────────── summon bugs ──► Bugdex ──► garden bonuses

 land & upgrades ──► 24+ plots ──► New Season ──► Golden Seeds (+growth, +yield, perks) ──► next run
```

1. **Garden** — plant seeds in plots and keep the plants healthy until they bear fruit. Plants are
   perennial and regrow after every harvest.
2. **Harvest** — ripe plants give fruit (and sometimes seeds). Better care gives more and better fruit.
3. **Sell** — fruit is the main source of coins: by hand or through the fruit stand.
4. **Summon** — put fruit in the capsule machine. The fruit decides *which bugs can appear* and *how
   lucky the pull is*. The machine gets hungrier as the Bugdex fills.
5. **Collect** — new species are added to the Bugdex and each one boosts the garden.
6. **Grow** — coins buy land, Shed upgrades, seeds and supplies.
7. **New Season** — trade a big garden for Golden Seeds and start again, faster.

The long-term goals are the full 48-plot garden and a complete Bugdex.

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
Care is measured continuously while a plant grows. Every second counts in full when the plot is
**watered and weed-free**, 65% when it's watered but weedy, and not at all when it's dry. Care is the
average over the crop. At harvest:

| Quality  | Requirement                                                        | Luck bonus | Fruit per harvest | Sell × |
|----------|--------------------------------------------------------------------|------------|-------------------|--------|
| Normal   | —                                                                  | +0         | 1                 | 1      |
| Fine     | care ≥ 60%                                                         | +0.25      | 2                 | 1.5    |
| Perfect  | care ≥ 90% **and** fertilized this cycle                           | +0.6       | 3                 | 2.5    |
| Prize    | *Show ribbon* unlock; care ≥ 95%, fertilized, hand-watered this cycle | +0.9    | 4                 | 3.5    |
| Heirloom | *Heirloom stock* unlock; Prize conditions, care ≥ 98%, vigor ≥ 80% | +1.3       | 5                 | 5      |

Herbicide sprayed during a crop drops its quality one tier (a Normal crop yields half instead).

Fruit per harvest is multiplied by the plant's **vigor** (see 4.3) and rounded randomly, so 2.4 fruit
pays 2 or 3 with the right average.

---

## 4. Garden

### 4.1 Plots
The garden is a fixed grid, 6 plots wide and up to 8 rows deep (48 plots). It starts as a 3×2 bed in
the top-left corner. Land is bought one plot at a time from a "Buy land" tile in the garden, in a
fixed order: rows 1–2 are widened to the full 6 columns, then whole rows are added below.
Each plot costs `80 × 1.2^(plots owned − 6)` coins. A plot holds at most one plant and up to 3 weeds.

### 4.2 Actions
| Action     | Effect |
|------------|--------|
| **Plant**  | Uses a seed from the seed pouch on an empty, weed-free plot. |
| **Dig up** | Removes the plant (+2 compost). Press twice within 3 s to confirm. |
| **Top-dress** | 2 compost → +25% vigor. |
| **Water**  | Refills moisture to 100% for every plot the watering can reaches (1×1, up to 4×4 with upgrades). Free and unlimited, but moisture drains over ~45 s. Dry plants grow at 15% speed. Hand-watering also **soaks** plots: +20% growth for 60 s. |
| **Weed**   | Click and drag a weed in the plot to pull it out by hand (there is no weed tool). Keyboard: Tab to a weed and press Enter; each weed takes 1–4 presses, with "keep pulling" updates until it comes out. With the **glove**, one pull clears the whole plot, then a 2×2 or 3×3 square, and keyboard players share one tug count across that square. Each weed slows growth by 15% and stops the crop reaching Perfect quality. Pulled weeds give **compost**, and occasionally a random **wild seed** turns up in the soil. A plain click on a weed (no drag) acts on the plot underneath. |
| **Clip**   | (Clippers) Clears weeds instantly from a plot (2×2 at level 2). No compost, and the roots stay: weeds come back twice as fast there for 3 minutes. |
| **Spray**  | (Herbicide sprayer) One dose kills the weeds and keeps new ones 3× slower for 10 minutes, but the crop growing there drops a quality tier. Doses cost 25 at the market. |
| **Fertilize** | Uses 1 fertilizer: +70% growth speed for 90 s and qualifies the fruit for *Perfect*. 3 compost → 1 fertilizer. |
| **Harvest** | Picks ripe fruit (see 3.3) from every ripe plot the basket reaches (1×1, up to 3×3). Plants are perennial: after a harvest they drop back to a sprout and regrow. Chance of a seed drop. |

### 4.3 Growth
Growth runs in real time (1 s ticks) and is also simulated for time spent away (up to 8 h, longer with
Stick insects in the Bugdex). After 10 minutes or more away, a **"While you were away"** summary shows coins
earned, fruit the wheelbarrow picked, ripe plants and new weeds.
Stages: **Seed → Sprout → Flowering → Ripe**. Growth time depends on the plant (50 s – 2.7 min),
with rarer plants taking longer. After a harvest a plant regrows from 25% (a sprout), so later crops
take 75% of the first one's time.

Plants never die, but each harvest wears **vigor** down by 6%, to a floor of 40%. Vigor multiplies
fruit per harvest, so old plants are worth top-dressing or replacing.

```
growth/sec = 1/growTime × (moist ? 1 : 0.15) × (1 − 0.15·weeds) × (fertilized ? 1.7 : 1)
             × (soaked ? 1.2 : 1) × Bugdex growth bonus × (1 + 0.05·Golden Seeds)
```

Weeds sprout on any plot at random (on average once every ~80 s per plot, max 3). Beetles in the
Bugdex, herbicide and the beetle patrol hold them back; nothing stops them for good.

### 4.4 The Shed (upgrades)
Upgrades are bought level by level in the Shed tab; each level costs several times the last.
Hovering or focusing a plot outlines the square the current tool would reach.

| Upgrade | Levels | Effect |
|---|---|---|
| Watering can | 150 / 1.2K / 9K | Water reach 2×2 → 3×3 → 4×4 |
| Irrigation pump | 4K … 250K (needs the 4×4 can) | Waters irrigated rows every 10 min → 5 min → 2 min → 45 s → around the clock. Never soaks. |
| Drip lines | 3K × 1.7^(lines owned) each | A garden row the pump waters |
| Gardening glove | 300 / 3K / 20K | One pull clears the plot → a 2×2 → a 3×3 square |
| Clippers | 800 / 7K | Clip tool, one plot → 2×2 |
| Herbicide sprayer | 2.5K (needs clippers) | Herbicide for sale; Spray tool |
| Beetle patrol | 60K / 240K (needs the 2×2 glove) | Eats one weed from every plot every 2 min → every minute. No compost. |
| Harvest basket | 250 / 2.5K | Harvest reach 2×2 → 3×3 |
| Wheelbarrow | 1.5K / 12K / 80K (needs the 2×2 basket) | Harvest all button; picks ripe plants into the barrow every 30/15/6 s until it holds 40/120/400. A full barrow stops until you tip it into the basket. |
| Trowel | 500 | 50% chance to get the seed back when digging up |
| Compost tumbler | 3K / 25K | Fertilizer costs 2 compost; then compost above 10 turns into fertilizer by itself |
| Show ribbon | 15K | Unlocks Prize fruit |
| Heirloom stock | 120K (needs the ribbon) | Unlocks Heirloom fruit |
| Fruit stand | 600 / 5K / 30K | Auto-sells the qualities you tick in the Market, 0.5/1.5/4 fruit per second |
| Market reputation | 400 × 4^n, 5 levels | +25% sell price per level |

### 4.5 Idle layer
- **Bugdex bonuses.** Every species owned adds +1% to a garden stat chosen by its order, and completing
  an order adds +10%:

  | Order | Stat |
  |---|---|
  | Hymenoptera | fruit per harvest |
  | Coleoptera | weeds come back slower |
  | Odonata | growth speed |
  | Lepidoptera | golden butterflies come more often |
  | Hemiptera | moisture lasts longer |
  | Orthoptera | sell price |
  | Phasmatodea | time the garden grows while you're away |
  | Neuroptera | slower vigor loss |
  | Diptera | extra compost from weeds |
  | Blattodea | fertilizer lasts longer |
  | Mantodea | wheelbarrow capacity |
  | Ephemeroptera | seed drops |

- **Golden butterfly.** Every 4–8 minutes of play a golden butterfly appears for 10 seconds. Click it or
  press **B** for one of: *Bloom* (every growing plant +15% growth), *Rain* (water and soak every plot),
  *Purse* (about 2 minutes of the garden's income), or *Seed gift* (2 uncommon-or-better seeds). It is
  announced to screen readers. Butterflies only come while you're playing, never during time away.
- **Achievements** (Journal tab): fruit harvested, plots owned, weeds pulled, species found, coins earned,
  butterflies caught, Heirloom fruit. Each one adds +1% fruit yield for good.
- The top bar shows **coins earned per second** over the last half-minute.

### 4.6 New Season (prestige)
Once the garden has **24 plots**, you can end the season (two presses to confirm, in the Journal).
- You earn **Golden Seeds** = `floor(sqrt(coins earned this season / 400))`.
- **Kept:** Bugdex, pity, achievements, lifetime stats, Golden Seeds, perks.
- **Reset:** land (back to 6 plots), coins, Shed upgrades, seeds, fruit, fertilizer, compost, herbicide.
- Every **unspent** Golden Seed gives +5% growth and +5% fruit yield.
- **Perks** cost Golden Seeds and last for good:

  | Perk | Cost | Effect |
  |---|---|---|
  | Head start: watering can | 3 | Each season starts with the 2×2 can |
  | Long nap | 4 | +4 h of growth while you're away |
  | Head start: land | 6 | Each season starts with 12 plots |
  | Head start: show ribbon | 8 | Each season starts with Prize fruit unlocked |
  | Old pipes | 10 | Each season starts with the pump (every 10 min) and a drip line on row 1 |

### 4.7 Balance targets
`src/game/balance.test.ts` plays the real reducer with simulated players and checks:
- **Early game:** first new plot within 3 minutes; 12 plots in 4–25 minutes.
- **Care matters:** a neglected garden yields under 35% per plot of a tended one.
- **Automation pays:** a fully automated late garden (no hand care) makes 30–60% of a perfectly tended
  one (measured ≈ 41%).
- **The long game:** a strong player reaches the full 48-plot garden over several seasons in 8–18 hours
  of play (measured ≈ 13 h, 6 seasons). The simulated player checks in every 5 seconds, so real players
  take longer.
- **The Bugdex stays a goal:** 40–150 species after the first hour.

---

## 5. Summoning (the capsule machine)

1. Pick a fruit from the basket and drop it in. The machine gets hungrier as the Bugdex fills:
   a capsule costs `1 + floor(species owned / 10)` of the same fruit (1 at the start, 20 near the end).
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
| Selling a fruit             | 3 / 8 / 16 by fruit tier, × 1 / 1.5 / 2.5 / 3.5 / 5 by quality, × reputation and crickets |
| Golden butterfly purse      | ~2 minutes of the garden's income |

| Sink                 | Cost |
|----------------------|------|
| Seeds                | 5 (common) / 12 (uncommon) / 30 (rare) |
| Fertilizer           | 8 |
| New plot             | 80 × 1.2^(plots owned − 6) |
| Shed upgrades        | 150 … 250K per level (see 4.4) |
| Drip lines           | 3K × 1.7^(lines owned) |
| Herbicide            | 25 per dose |
| Shop refresh         | 5 (free refresh every 3 min) |

**Shop:** always sells Apple and Strawberry seeds and fertilizer, plus 4 rotating slots drawn
by seed tier (Common 60%, Uncommon 30%, Rare 10%).

**Starting kit:** 30 coins, 3 Apple, 3 Strawberry, 2 Raspberry seeds, 2 fertilizer.

---

## 7. Screens

| Screen        | Contents |
|---------------|----------|
| **Garden**    | 6-wide plot grid with a "Buy land" tile. Select a plot to see moisture, weeds, growth, care, vigor; top-dress and dig up. Seed pouch to plant. |
| **Summon**    | Capsule machine, fruit basket with effects and odds table, pity meter, reveal animation. |
| **Bugdex**    | All species as cards (silhouettes for undiscovered), filter by order/rarity/owned, progress per order. Detail view with Wikipedia photo, extract, status, owned count, release button, link to article. |
| **Shed**      | Upgrades by category (watering, weeding, harvesting, soil & quality, market) and drip lines. |
| **Market**    | Buy seeds and fertilizer; sell fruit (and choose what the fruit stand sells); compost → fertilizer. |
| **Journal**   | New Season (Golden Seeds, perks), Bugdex bonuses by order, and achievements. |

A top bar shows coins (with coins earned per second), fertilizer, compost, Golden Seeds and Bugdex
progress on every screen. The golden butterfly can appear over any screen.

---

## 8. Persistence
State is saved to `localStorage` (`bug-garden-save-v1`) every few seconds and on page hide.
A save includes a version number. Version 1 saves (before the grid) are migrated: their plots are
laid onto the grid in buying order and every plant becomes a full-vigor perennial. Unknown versions
start a fresh game. A "Reset game"
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

## 10. Out of scope
Accounts / cloud saves, trading, sound, weather, bug "habitats" in the garden. These are natural
next steps.
