import { BALANCE } from '../config/balance.js';
import { LOCATIONS, SPECIES } from '../config/species.js';
import { createMonster } from './monsters.js';
import { enclosureCenter } from './staff.js';

let nextEggId = 1;

export class ExpeditionBase {
  constructor() {
    this.active = null; // { locationId, remainingSec, durationSec }
  }

  start(locationId, wallet) {
    if (this.active) return { ok: false, reason: 'busy' };
    if (!wallet.spend(BALANCE.expeditionCost)) return { ok: false, reason: 'noMoney' };
    const durationSec = LOCATIONS[locationId].durationSec;
    this.active = { locationId, remainingSec: durationSec, durationSec };
    return { ok: true };
  }

  // Used later by the rewarded ad "finish now".
  finishNow() {
    if (this.active) this.active.remainingSec = 0;
  }

  // Returns the egg brought back when the expedition ends, else null.
  update(dt, rng) {
    if (!this.active) return null;
    this.active.remainingSec -= dt;
    if (this.active.remainingSec > 1e-9) return null;
    const loc = LOCATIONS[this.active.locationId];
    this.active = null;
    const speciesId = loc.species[Math.floor(rng() * loc.species.length) % loc.species.length];
    return {
      id: `egg${nextEggId++}`,
      locationId: loc.id,
      speciesId,
      rare: rng() < BALANCE.rareChance,
      remainingSec: BALANCE.hatchTimeSec,
      ready: false,
    };
  }
}

export class Hatchery {
  constructor() {
    this.eggs = [];
    this.stored = [];
  }

  addEgg(egg) {
    this.eggs.push(egg);
  }

  // Advances egg timers; returns the monsters that hatched during this update.
  update(dt) {
    const born = [];
    for (const egg of [...this.eggs]) {
      if (!egg.ready) {
        egg.remainingSec -= dt;
        if (egg.remainingSec <= 1e-9) {
          egg.remainingSec = 0;
          egg.ready = true;
        }
      }
      if (egg.ready && this.stored.length < BALANCE.hatcheryCapacity) {
        const m = createMonster(egg.speciesId, { rare: egg.rare });
        this.stored.push(m);
        this.eggs.splice(this.eggs.indexOf(egg), 1);
        born.push(m);
      }
    }
    return born;
  }

  // force: accept even when full (a caught monster with no enclosure must never be lost).
  storeMonster(monster, { force = false } = {}) {
    if (!force && this.stored.length >= BALANCE.hatcheryCapacity) return false;
    monster.state = 'stored';
    monster.enclosureId = null;
    this.stored.push(monster);
    return true;
  }

  takeMonster(id) {
    const i = this.stored.findIndex((m) => m.id === id);
    if (i < 0) return null;
    return this.stored.splice(i, 1)[0];
  }
}

export function placeMonsterInEnclosure(monster, enclosure) {
  if (SPECIES[monster.speciesId].habitat !== enclosure.habitat) return { ok: false, reason: 'wrongHabitat' };
  if (enclosure.monsterId) return { ok: false, reason: 'occupied' };
  enclosure.monsterId = monster.id;
  monster.enclosureId = enclosure.id;
  monster.state = 'enclosed';
  monster.pos = enclosureCenter(enclosure);
  return { ok: true };
}
