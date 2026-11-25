import { BALANCE } from '../config/balance.js';
import { Grid } from './grid.js';
import { Wallet } from './wallet.js';
import { Builder } from './build.js';
import { createRng } from './rng.js';
import { createMonster, updateMonster, escapeChancePerSec, feed } from './monsters.js';
import { createVisitor, updateVisitor, spawnIntervalSec } from './visitors.js';
import { hireKeeper, escapeMonster, updateEscaped, updateKeeper, catchByClick } from './staff.js';
import { ExpeditionBase, Hatchery, placeMonsterInEnclosure } from './expeditions.js';
import { computeReputation } from './reputation.js';
import { checkObjectives, speciesOwned } from './objectives.js';

const MAX_VISITORS = 150;
const MIN_SPAWN_INTERVAL = 0.5;
const SATISFACTION_MEMORY = 20;
const ESCAPE_MEMORY_SEC = 300;

export class World {
  constructor(seed = 1) {
    this.rng = createRng(seed);
    this.grid = new Grid(40, 40);
    this.wallet = new Wallet(BALANCE.startMoney);
    this.builder = new Builder(this.grid, this.wallet);
    this.monsters = new Map();
    this.visitors = [];
    this.keepers = [];
    this.expeditionBase = new ExpeditionBase();
    this.hatchery = new Hatchery();
    this.entrance = { tx: 20, ty: 39 };
    this.ticketPrice = BALANCE.ticketPriceDefault;
    this.speed = 1;
    this.time = 0;
    this.spawnTimer = 0;
    this.totalVisitors = 0;
    this.recentSatisfaction = [];
    this.escapeTimes = [];
    this.reputation = 0;
    this.completedObjectives = new Set();
    this.events = [];
    this.builder.onEnclosureEmptied = (monsterId) => this.#onEnclosureEmptied(monsterId);
    this.builder.isBlocked = (x, y) => {
      for (const m of this.monsters.values()) {
        if (m.state !== 'escaped') continue;
        if (m.tile.tx === x && m.tile.ty === y) return true;
        if (m.wanderTarget && m.wanderTarget.tx === x && m.wanderTarget.ty === y) return true;
      }
      return false;
    };
    this.builder.protectedTiles.add(`${this.entrance.tx},${this.entrance.ty}`);
    this.ctx = {
      grid: this.grid,
      builder: this.builder,
      monsters: this.monsters,
      visitors: this.visitors,
      keepers: this.keepers,
      entrance: this.entrance,
      wallet: this.wallet,
      rng: this.rng,
      storeMonster: (m, opts) => this.hatchery.storeMonster(m, opts),
    };
  }

  setSpeed(s) {
    this.speed = s;
  }

  setTicketPrice(p) {
    this.ticketPrice = Math.max(0, Math.min(100, Math.round(p)));
  }

  tick(realDt) {
    const gameDt = realDt * this.speed;
    if (gameDt <= 0) return;
    const n = Math.max(1, Math.ceil(gameDt / BALANCE.maxSubstepSec - 1e-9));
    const dt = gameDt / n;
    for (let i = 0; i < n; i++) this.#step(dt);
  }

  // ---- player actions -------------------------------------------------

  feedMonster(id) {
    const m = this.monsters.get(id);
    if (!m) return { ok: false, reason: 'nothing' };
    if (!this.wallet.spend(BALANCE.feedCost)) return { ok: false, reason: 'noMoney' };
    feed(m);
    return { ok: true };
  }

  hireKeeper() {
    return hireKeeper(this.keepers, this.wallet, this.entrance);
  }

  startExpedition(locationId) {
    return this.expeditionBase.start(locationId, this.wallet);
  }

  placeStoredMonster(monsterId, enclosureId) {
    const m = this.hatchery.stored.find((x) => x.id === monsterId);
    const e = this.builder.enclosures.get(enclosureId);
    if (!m || !e) return { ok: false, reason: 'nothing' };
    const r = placeMonsterInEnclosure(m, e);
    if (r.ok) this.hatchery.takeMonster(monsterId);
    return r;
  }

  catchMonster(id) {
    const m = this.monsters.get(id);
    if (m) catchByClick(m, this.ctx);
  }

  speciesCount() {
    return speciesOwned(this);
  }

  // ---- simulation -----------------------------------------------------

  #onEnclosureEmptied(monsterId) {
    const m = this.monsters.get(monsterId);
    if (!m) return true;
    if (m.state === 'escaped') {
      m.enclosureId = null; // goes to the hatchery when caught
      return true;
    }
    return this.hatchery.storeMonster(m);
  }

  #step(dt) {
    this.time += dt;
    const watchers = new Map();
    for (const v of this.visitors) {
      if (v.state === 'watching' && v.target) watchers.set(v.target.id, (watchers.get(v.target.id) || 0) + 1);
    }

    for (const m of this.monsters.values()) {
      if (m.state === 'enclosed') {
        const e = this.builder.enclosures.get(m.enclosureId);
        updateMonster(m, e, watchers.get(e.id) || 0, dt);
        if (this.rng() < escapeChancePerSec(m) * dt && escapeMonster(m, e, this.grid)) {
          this.escapeTimes.push(this.time);
          this.events.push({ type: 'escape', monsterId: m.id, speciesId: m.speciesId });
        }
      } else if (m.state === 'escaped') {
        updateEscaped(m, this.ctx, dt);
      }
    }
    for (const k of this.keepers) updateKeeper(k, this.ctx, dt);

    for (const v of this.visitors) updateVisitor(v, this.ctx, dt);
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const v = this.visitors[i];
      if (v.state !== 'gone') continue;
      this.recentSatisfaction.push(v.satisfaction);
      if (this.recentSatisfaction.length > SATISFACTION_MEMORY) this.recentSatisfaction.shift();
      this.visitors.splice(i, 1);
    }

    this.spawnTimer += dt;
    const interval = Math.max(MIN_SPAWN_INTERVAL, spawnIntervalSec(this.reputation, this.ticketPrice));
    if (this.spawnTimer >= interval && this.visitors.length < MAX_VISITORS) {
      this.spawnTimer = 0;
      this.visitors.push(createVisitor(this.entrance, Math.floor(this.rng() * 4)));
      this.totalVisitors++;
      this.wallet.earn(this.ticketPrice);
    }

    const egg = this.expeditionBase.update(dt, this.rng);
    if (egg) {
      this.hatchery.addEgg(egg);
      this.events.push({ type: 'eggReady', egg });
    }
    for (const m of this.hatchery.update(dt)) {
      this.monsters.set(m.id, m);
      this.events.push({ type: 'hatched', monsterId: m.id, speciesId: m.speciesId, rare: m.rare });
    }

    if (this.keepers.length) this.wallet.charge((BALANCE.keeperSalaryPerMin * this.keepers.length * dt) / 60);

    while (this.escapeTimes.length && this.escapeTimes[0] < this.time - ESCAPE_MEMORY_SEC) this.escapeTimes.shift();
    const sats = this.recentSatisfaction;
    this.reputation = computeReputation({
      avgSatisfaction: sats.length ? sats.reduce((a, b) => a + b, 0) / sats.length : 0.5,
      speciesCount: speciesOwned(this),
      escapesLast5Min: this.escapeTimes.length,
    });

    for (const id of checkObjectives(this)) this.events.push({ type: 'objective', id });
  }
}

export function createInitialWorld(seed = 1) {
  const w = new World(seed);
  const b = w.builder;
  for (let y = 34; y <= 39; y++) b.placePath(20, y);
  b.placeBuilding('expeditionBase', 21, 37, { free: true, fixed: true });
  b.placeBuilding('hatchery', 18, 37, { free: true, fixed: true });
  const enc = b.placeEnclosure(21, 34, 23, 35, 'forest');
  const golem = createMonster('golem');
  w.monsters.set(golem.id, golem);
  placeMonsterInEnclosure(golem, b.enclosures.get(enc.id));
  w.wallet.money = BALANCE.startMoney;
  w.wallet.totalEarned = 0;
  return w;
}
