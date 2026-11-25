# Musée des Monstres — Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser prototype of an isometric 2D monster-museum tycoon (build, visitors, monsters, escapes, expeditions, eggs) to check that it is fun.

**Architecture:** All game rules live in a pure-JavaScript simulation (`src/sim/`) with no Phaser dependency, unit-tested with Vitest and advanced by `world.tick(dt)`. Phaser (`src/render/`) only draws the world state and turns mouse/keyboard input into calls on the simulation. All graphics are generated in code at boot as Phaser textures.

**Tech Stack:** Node 24, Vite 5.4.11, Phaser 3.80.1, Vitest 2.1.8, plain JavaScript (ES modules).

**Spec:** `docs/2026-11-25-musee-des-monstres-design.md`

## Global Constraints

- Runs in a recent desktop browser; `npm run build` produces a static folder (`dist/`) with relative asset paths (`base: './'` in Vite config).
- No image files: every visual is drawn in code (flat cartoon style, bright colors, thick outlines).
- Every player-visible string goes through `t(key)` from `src/i18n/index.js`; French strings in `src/i18n/fr.js`. No hard-coded UI text elsewhere.
- Family-friendly: a "bitten" visitor runs away comically; nobody dies.
- No game over. Money may go negative (salaries); while negative, every purchase is refused.
- Isometric 2:1 grid, 40 × 40 tiles. Tile size 64 × 32 px.
- One monster per enclosure. Hatchery holds at most 3 waiting monsters.
- Shops and enclosures are only used by visitors if they touch a path tile.
- Demolish refunds 50 % of the price.
- Game speeds: pause, x1, x2, x3. Simulation advances in fixed sub-steps of at most 0.1 s game time.
- No save, no ads, no sound in this prototype.

## Review Focus

1. Placing anything on an occupied or out-of-bounds tile → refused, no money spent, nothing changes. *(Task 3)*
2. Demolishing a path under a walking visitor or keeper → they re-path to the exit/target; never stuck forever, never walk through grass. *(Task 6)*
3. An egg hatching while the hatchery already holds 3 monsters → the egg stays "ready" and hatches when a slot frees; it is never lost. *(Task 8)*
4. x3 speed or a long frame (tab in background, dt = 5 s) → simulation stays stable: same result as many small ticks, no monster teleporting through fences. *(Task 9)*
5. Selling/demolishing an enclosure that holds a monster → the monster returns to the hatchery if a slot is free, otherwise demolish is refused with a message. *(Task 3)*

---

## File structure

```
package.json, vite.config.js, index.html, .gitignore
src/main.js                    Phaser boot (game config, scenes)
src/config/balance.js          every tunable number (export const BALANCE)
src/config/species.js          5 species + 5 expedition locations
src/i18n/fr.js, index.js       strings + t(key, vars)
src/sim/rng.js                 seedable RNG
src/sim/iso.js                 tile <-> screen conversion
src/sim/grid.js                tiles, occupancy, bounds
src/sim/wallet.js              money
src/sim/build.js               place/demolish paths, enclosures, buildings
src/sim/pathfinding.js         BFS over path tiles
src/sim/monsters.js            happiness, hunger, escape roll, appeal
src/sim/visitors.js            spawn rate, visitor state machine, spending
src/sim/staff.js               keepers, chasing escaped monsters
src/sim/expeditions.js         expeditions, eggs, hatchery
src/sim/reputation.js          stars 0–5
src/sim/objectives.js          objective list and checks
src/sim/world.js               World: owns everything, tick(dt), createInitialWorld()
src/render/textures.js         procedural textures
src/render/GameScene.js        map, entities, camera, build input
src/render/UIScene.js          top bar, toolbar, info panels, objectives
tests/sim/*.test.js            one test file per sim module
```

---

### Task 1: Project setup, config and i18n

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.js`, `src/config/balance.js`, `src/config/species.js`, `src/i18n/fr.js`, `src/i18n/index.js`, `src/sim/rng.js`
- Test: `tests/sim/config.test.js`

**Interfaces:**
- Produces:
  - `BALANCE` object (exact values below).
  - `SPECIES: Record<SpeciesId, {id, habitat, minArea, appeal, decayPerMin, special}>`, `SpeciesId = 'dragonnet'|'kraken'|'spectre'|'golem'|'yeti'`, `Habitat = 'lava'|'water'|'dark'|'forest'|'ice'`.
  - `LOCATIONS: Record<LocationId, {id, species: SpeciesId[], durationSec}>`, `LocationId = 'volcano'|'lagoon'|'crypt'|'ancientForest'|'glacier'`.
  - `t(key: string, vars?: object): string` — returns the key itself if missing.
  - `createRng(seed: number): () => number` (mulberry32, returns [0,1)).

`BALANCE` values (starting values, tune later):
```
startMoney 5000; pathCost 10; enclosureCostPerTile 50; decorationCost 100;
snackCost 500; souvenirCost 800; keeperHireCost 300; keeperSalaryPerMin 20; feedCost 20; demolishRefund 0.5;
ticketPriceDefault 20; ticketPriceRef 20; visitorBaseIntervalSec 8;
expeditionCost 500; rareChance 0.1; rareAppealMult 2; hatchTimeSec 30;
hatcheryCapacity 3; escapeThreshold 20; escapeMaxChancePerSec 0.02;
hungerPerMin 10; snackPrice 8; souvenirPrice 15; decorationRadius 3;
maxSubstepSec 0.1
```
Species: dragonnet lava minArea 6 appeal 10 decay 6 (special 'hotTemper'); kraken water minArea 12 appeal 7 decay 3; spectre dark minArea 6 appeal 8 decay 4 (special 'phases': escape chance ×2); golem forest minArea 4 appeal 4 decay 1.5; yeti ice minArea 8 appeal 7 decay 3 (special 'lovesVisitors': +5 happiness/min while ≥ 3 visitors watching). Locations map 1:1 to species in the order above, durations 60, 90, 120, 60, 180 s.

- [ ] **Step 1:** `git init`, `npm init -y`, install `phaser@3.80.1` and dev deps `vite@5.4.11 vitest@2.1.8`. Scripts: `dev: vite`, `build: vite build`, `test: vitest run`. `vite.config.js` sets `base: './'`. `.gitignore`: `node_modules`, `dist`.
- [ ] **Step 2: Write failing tests** in `tests/sim/config.test.js`:
  - `every species habitat is one of the 5 habitats`
  - `every location lists only existing species`
  - `t returns French string and interpolates` → `t('hud.money', {n: 12})` contains `12`
  - `t returns key when missing` → `t('nope.key') === 'nope.key'`
  - `rng with same seed gives same sequence` (first 5 values equal) and all in [0,1)
- [ ] **Step 3:** Run `npm test` → FAIL (modules missing).
- [ ] **Step 4:** Implement the config, i18n and rng files. `index.html` loads `src/main.js`; `main.js` boots an empty Phaser game (1280×720, `Phaser.Scale.RESIZE`) so `npm run dev` shows a colored canvas.
- [ ] **Step 5:** Run `npm test` → PASS. Run `npm run dev`, open the page → canvas visible, no console errors.
- [ ] **Step 6:** Commit `chore: project setup, config, i18n`.

---

### Task 2: Isometric math and grid

**Files:** Create `src/sim/iso.js`, `src/sim/grid.js`. Test `tests/sim/iso.test.js`, `tests/sim/grid.test.js`.

**Interfaces:**
- Produces:
  - `tileToScreen(tx, ty): {x, y}` — tile center, `x = (tx - ty) * 32`, `y = (tx + ty) * 16`.
  - `screenToTile(x, y): {tx, ty}` — inverse, `Math.floor` of the exact inverse.
  - `class Grid { constructor(w, h); inBounds(tx,ty); getTile(tx,ty): {ground: 'grass'|'path', occupant: string|null}; setGround(tx,ty,g); setOccupant(tx,ty,id|null); isFree(tx,ty): boolean; neighbors4(tx,ty): {tx,ty}[] }`
  - `isFree` = in bounds, ground grass, no occupant.

- [ ] **Step 1: Failing tests:** `screenToTile(tileToScreen(t)) === t` for 20 random tiles; `inBounds(-1,0) === false`, `inBounds(39,39) === true` on a 40×40 grid; `neighbors4(0,0)` has length 2; `isFree` false after `setOccupant`, false on path.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(sim): iso math and grid`.

---

### Task 3: Wallet and building / demolishing

**Files:** Create `src/sim/wallet.js`, `src/sim/build.js`. Test `tests/sim/build.test.js`.

**Interfaces:**
- Consumes: `Grid`, `BALANCE`.
- Produces:
  - `class Wallet { money; canAfford(n): boolean /* false if money < n or money < 0 */; spend(n): boolean; earn(n); charge(n) /* always applied, may go negative */ }`
  - `BuildingType = 'decoration'|'snack'|'souvenir'|'expeditionBase'|'hatchery'`; all are 1×1 tiles except `expeditionBase` and `hatchery` (2×2).
  - `class Builder { constructor(grid, wallet); placePath(tx,ty): Result; placeEnclosure(x0,y0,x1,y1, habitat): Result; placeBuilding(type, tx,ty): Result; demolish(tx,ty): Result; enclosures: Map<id, Enclosure>; buildings: Map<id, Building>; touchesPath(id): boolean }`
  - `Result = {ok: true, id?} | {ok: false, reason: 'occupied'|'outOfBounds'|'noMoney'|'enclosureNotEmpty'}`
  - `Enclosure = {id, x0,y0,x1,y1, habitat, area, monsterId: string|null}` (rectangle, min 2×2, tiles inside become occupant = id).
  - `demolish` on an enclosure with a monster calls an injected `onEnclosureEmptied(monsterId): boolean` hook (set by World, returns false if hatchery full) — if it returns false, result `enclosureNotEmpty`.

- [ ] **Step 1: Failing tests:**
  - `placePath spends pathCost and sets ground` (money 5000 → 4990)
  - `placing on occupied tile refuses and keeps money` (Review Focus 1)
  - `placing out of bounds refuses and keeps money` (Review Focus 1)
  - `enclosure 3×2 costs 6 × 50 = 300 and area 6`
  - `enclosure smaller than 2×2 refused`
  - `purchase refused when money negative` (after `charge` to −10, `placePath` → `noMoney`)
  - `demolish refunds 50 %` (decoration 100 → +50)
  - `demolish occupied enclosure refused when hook returns false; allowed when true` (Review Focus 5)
  - `touchesPath true only when a tile on the border is adjacent to a path`
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(sim): wallet and building`.

---

### Task 4: Monsters

**Files:** Create `src/sim/monsters.js`. Test `tests/sim/monsters.test.js`.

**Interfaces:**
- Consumes: `SPECIES`, `BALANCE`, rng.
- Produces:
  - `createMonster(speciesId, {rare: boolean}): Monster` — `{id, speciesId, rare, happiness: 70, hunger: 0, state: 'enclosed'|'escaped'|'stored', enclosureId: null, pos: {x,y}}` (pos in tile units, float).
  - `targetHappiness(monster, enclosure, watchers: number): number` — `100 × habitatFactor × sizeFactor − hunger × 0.5`, clamped 0–100; `habitatFactor` 1 if habitat matches else 0.3; `sizeFactor = min(1, area / minArea)`.
  - `updateMonster(monster, enclosure, watchers, dt): void` — hunger rises `hungerPerMin`; happiness moves toward target by `decayPerMin` per minute (up or down); yeti bonus per spec.
  - `escapeChancePerSec(monster): number` — 0 if happiness ≥ 20, else `(20 − h)/20 × 0.02`, ×2 for `phases`.
  - `feed(monster): void` — hunger = 0.
  - `appeal(monster): number` — `species.appeal × (rare ? 2 : 1) × (happiness / 100)`.

- [ ] **Step 1: Failing tests:** right habitat + big enough + fed → target 100; wrong habitat → 30; half area → 50; happiness falls over 10 simulated minutes when hungry; `escapeChancePerSec` is 0 at 20, 0.01 at 10, 0.02 for spectre at 10; `appeal` doubles for rare; `feed` resets hunger.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): monsters`.

---

### Task 5: Pathfinding

**Files:** Create `src/sim/pathfinding.js`. Test `tests/sim/pathfinding.test.js`.

**Interfaces:**
- Consumes: `Grid`.
- Produces: `findPath(grid, from, to, {allowGrass = false} = {}): {tx,ty}[] | null` — BFS over 4-neighbours; walkable = path ground (or any non-occupied tile when `allowGrass`, used by keepers and escaped monsters). Returns tiles from `from` (excluded) to `to` (included); `[]` if from equals to; `null` if unreachable.

- [ ] **Step 1: Failing tests:** straight path found with correct length; L-shaped path; `null` when the path is cut; `allowGrass` finds a route over grass but not through occupied tiles.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): pathfinding`.

---

### Task 6: Visitors

**Files:** Create `src/sim/visitors.js`. Test `tests/sim/visitors.test.js`.

**Interfaces:**
- Consumes: `findPath`, `Grid`, `Builder` (enclosures/buildings, `touchesPath`), `appeal`, `BALANCE`, rng.
- Produces:
  - `spawnIntervalSec(reputation, ticketPrice): number` — `visitorBaseIntervalSec / (0.5 + reputation / 2) × (ticketPrice / ticketPriceRef)`.
  - `class Visitor { id; pos; state: 'walking'|'watching'|'shopping'|'fleeing'|'leaving'|'gone'; mood: 'happy'|'bored'|'hungry'|'scared'; satisfaction: 0..1; path; target }`
  - `updateVisitor(visitor, ctx, dt)` where `ctx = {grid, builder, monsters, entrance, wallet, rng}`. Behaviour: pick a random reachable target among path-adjacent enclosures (weighted by monster appeal) and shops; walk at 1.5 tiles/s; watch 5 s (satisfaction += appeal/50, capped 1); after 3 targets or 120 s leave via the entrance. Hunger mood after 60 s → prefers snack (pays `snackPrice`). Souvenir shop visited with probability `satisfaction` before leaving (pays `souvenirPrice`). Decorations within `decorationRadius` tiles raise satisfaction by 0.02/s.
  - `scare(visitor)` — state `fleeing`, mood `scared`, satisfaction −0.5, runs to the entrance at 3 tiles/s, then `gone`.
  - On each new tile: if the next tile is no longer a path, re-run `findPath` to the target; if `null`, re-path to the entrance; if still `null`, walk over grass straight to the entrance (`allowGrass`) (Review Focus 2).

- [ ] **Step 1: Failing tests:** `spawnIntervalSec(0, 20) === 16`, `spawnIntervalSec(5, 20) ≈ 2.67`, doubles when price doubles; a visitor on a line of paths reaches a path-adjacent enclosure and enters `watching`; an enclosure not touching a path is never chosen; `scare` sets fleeing and the visitor ends `gone`; **demolishing the path tile ahead makes the visitor re-path and still reach `gone`, never stuck more than 30 s** (Review Focus 2); a hungry visitor next to a snack pays 8.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): visitors`.

---

### Task 7: Keepers and escapes

**Files:** Create `src/sim/staff.js`. Test `tests/sim/staff.test.js`.

**Interfaces:**
- Consumes: `findPath` (`allowGrass: true`), monsters, visitors (`scare`), `BALANCE`.
- Produces:
  - `class Keeper { id; pos; state: 'patrol'|'chasing'|'returning'; targetMonsterId }`
  - `hireKeeper(keepers: Keeper[], wallet: Wallet, spawnTile: {tx,ty}): Result` (cost `keeperHireCost`, keeper appears on `spawnTile` = entrance).
  - Expedition base and hatchery are pre-placed by `createInitialWorld` and cannot be bought or demolished in the prototype.
  - `escapeMonster(monster, enclosure)` — state `escaped`, placed on the nearest free tile outside the enclosure.
  - `updateEscaped(monster, ctx, dt)` — wanders 1 tile/s; any visitor within 2 tiles → `scare`.
  - `updateKeeper(keeper, ctx, dt)` — nearest escaped monster not already targeted → chase at 2.5 tiles/s; on contact the monster returns to its enclosure (`enclosed`, happiness +20). Patrol = random walk on paths.
  - `catchByClick(monster)` — same effect as a keeper catch.
  - Salary: `wallet.charge(keeperSalaryPerMin × keepers / 60 × dt)` applied by World.

- [ ] **Step 1: Failing tests:** an escaped monster next to a visitor scares it; a keeper reaches and returns an escaped monster within expected time on an open grid; two keepers never target the same monster; `catchByClick` returns the monster with +20 happiness.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): keepers and escapes`.

---

### Task 8: Expeditions, eggs and hatchery

**Files:** Create `src/sim/expeditions.js`. Test `tests/sim/expeditions.test.js`.

**Interfaces:**
- Consumes: `LOCATIONS`, `createMonster`, `Wallet`, rng, `BALANCE`.
- Produces:
  - `class ExpeditionBase { active: {locationId, remainingSec} | null; start(locationId, wallet): Result /* one at a time, cost expeditionCost */; update(dt, rng): Egg | null }`
  - `Egg = {id, speciesId, rare, remainingSec: hatchTimeSec, ready: boolean}` — species drawn from the location list, `rare` with `rareChance`.
  - `class Hatchery { eggs: Egg[]; stored: Monster[]; addEgg(egg); update(dt): void /* an egg whose timer ends becomes ready; a ready egg hatches only if stored.length < hatcheryCapacity */; takeMonster(id): Monster | null; storeMonster(m): boolean }`
  - `placeMonsterInEnclosure(monster, enclosure): Result` — refused (`reason: 'wrongHabitat'` or `'occupied'`) unless habitat matches and the enclosure is empty.

- [ ] **Step 1: Failing tests:** starting costs 500 and a second start while active is refused; after `durationSec` an egg of the location's species is returned; with rng forced below 0.1 the egg is rare; an egg hatches after 30 s; **with 3 stored monsters a finished egg stays `ready` and hatches right after one is taken** (Review Focus 3); placing a lava monster in a water enclosure is refused.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): expeditions and hatchery`.

---

### Task 9: Reputation, objectives and World

**Files:** Create `src/sim/reputation.js`, `src/sim/objectives.js`, `src/sim/world.js`. Test `tests/sim/world.test.js`.

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `computeReputation({avgSatisfaction, speciesCount, escapesLast5Min}): number` — `clamp(avgSatisfaction × 3 + min(speciesCount, 5) × 0.4 − escapesLast5Min × 0.5, 0, 5)`; `avgSatisfaction` of the last 20 visitors who left (0.5 when none).
  - `OBJECTIVES`: `visitors10`, `species3`, `money10000`, `visitors50`, `allSpecies`; `checkObjectives(world): string[]` returns newly completed ids.
  - `createInitialWorld(seed = 1): World` — 40×40 grid, entrance at (20, 39), path from (20,39) to (20,34), expedition base and hatchery next to the path, one golem in a 3×2 forest enclosure touching the path, money 5000, ticket price 20, speed 1.
  - `class World { grid; wallet; builder; monsters; visitors; keepers; expeditionBase; hatchery; reputation; ticketPrice; speed: 0|1|2|3; completedObjectives; events: {type, ...}[]; tick(realDt); setSpeed(s); setTicketPrice(p) }`
  - `tick(realDt)`: `gameDt = realDt × speed`, processed in sub-steps of ≤ `maxSubstepSec`; each sub-step: monsters update + escape roll, escaped monsters, keepers, visitors, spawning (entrance pays ticket price on arrival), expeditions, hatchery, salaries, reputation, objectives. Pushes `events` (`escape`, `eggReady`, `hatched`, `objective`, `noMoney`) that the UI drains.

- [ ] **Step 1: Failing tests:**
  - `initial world has 5000 money, 1 golem enclosed, entrance path`
  - `after 120 s at x1, at least 5 visitors spawned and money increased`
  - `tick(5) gives the same state as 50 × tick(0.1)` with the same seed (Review Focus 4)
  - `speed 0 changes nothing`
  - `reputation formula`: (0.5, 1, 0) → 1.9; clamp at 0 and 5
  - `species3 objective completes once 3 species are owned`
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(sim): world, reputation, objectives`.

---

### Task 10: Procedural textures and map rendering

**Files:** Create `src/render/textures.js`, `src/render/GameScene.js`; modify `src/main.js`.

**Interfaces:**
- Consumes: `World`, `tileToScreen`, `screenToTile`, `SPECIES`.
- Produces:
  - `generateTextures(scene)` — draws with `scene.make.graphics` + `generateTexture` the keys: `tile-grass`, `tile-path`, `tile-<habitat>` (5), `fence`, `monster-<speciesId>` and `monster-<speciesId>-rare` (10), `visitor-0..3` (4 color variants), `keeper`, `decoration`, `snack`, `souvenir`, `expeditionBase`, `hatchery`, `egg`, `bubble-<mood>` (4). Style: flat fills, 3 px dark outline, big eyes on monsters, each species with a clear silhouette (dragonnet: wings + small horns, kraken: tentacles, spectre: wavy transparent body, golem: square mossy body, yeti: round white fur).
  - `GameScene` — owns the `World`, calls `world.tick(delta / 1000)` in `update`, draws tiles once and redraws only changed tiles, keeps one sprite per entity keyed by id (depth = screen y), camera drag (right or middle mouse) + arrow keys, wheel zoom 0.5–2.

This task is visual: no unit test. Verification is in the browser.

- [ ] **Step 1:** Implement textures and scene.
- [ ] **Step 2:** `npm run dev` → the initial museum is visible: grass, path, entrance, golem in its forest enclosure, visitors arriving and walking, monster bubbles; camera pans and zooms; no console errors. `npm test` still PASS.
- [ ] **Step 3:** Commit `feat(render): procedural textures and map`.

---

### Task 11: UI — top bar, toolbar, building, info panels

**Files:** Create `src/render/UIScene.js`; modify `src/render/GameScene.js`, `src/i18n/fr.js`.

**Interfaces:**
- Consumes: `World` (same instance, passed via scene data), `Builder`, `ExpeditionBase`, `Hatchery`, `t`.
- Produces:
  - Top bar: money, visitor count, reputation stars, speed buttons (pause/x1/x2/x3), ticket price − / + (step 5, range 0–100).
  - Toolbar: Path, Enclosure (then habitat choice), Decoration, Snack, Souvenir, Keeper, Demolish, each with its price. Hover shows a green/red ghost of the placement; enclosure = drag a rectangle. Refused placements show the `Result.reason` as a short message (`t('error.<reason>')`).
  - Click a monster → panel: name, happiness bar, hunger, "Feed" button; escaped monster click → `catchByClick`. Click a visitor → mood and satisfaction. Click the expedition base → list of 5 locations with duration and cost, progress bar while active. Click the hatchery → eggs with timers and stored monsters; "Place" then click a matching enclosure.
  - Objectives list in a corner; toast messages for `events`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Manual check in `npm run dev`, all of these must work:
  - build a path, a 3×3 lava enclosure, a snack and a decoration; money goes down by the right amounts;
  - placing on an occupied tile shows the error and keeps money;
  - launch a volcano expedition, set speed x3, egg arrives, hatches, place the dragonnet in the lava enclosure;
  - leave the dragonnet unfed until it escapes; visitors flee; hire a keeper who brings it back; click-catch also works;
  - demolish a path under walking visitors: they find another way or leave.
- [ ] **Step 3:** `npm test` PASS. Commit `feat(render): UI and building tools`.

---

### Task 12: Balance pass and build

**Files:** Modify `src/config/balance.js` if needed; create `README.md` (how to run, test, build — in French).

- [ ] **Step 1:** Play 15 minutes from the start. Targets: first new species within ~3 minutes, first escape possible but avoidable, money never stuck for more than 2 minutes. Adjust `BALANCE` values only.
- [ ] **Step 2:** `npm test` → PASS. `npm run build` → `dist/` created; open `dist/index.html` through `npx vite preview` → game runs.
- [ ] **Step 3:** Commit `chore: balance pass, README, build`.
