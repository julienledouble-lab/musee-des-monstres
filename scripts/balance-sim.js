// Plays the first minutes headlessly with a simple "reasonable player"
// and prints the economy, to tune src/config/balance.js.
// Run: node scripts/balance-sim.js
import { createInitialWorld } from '../src/sim/world.js';

const w = createInitialWorld(42);
const b = w.builder;
const log = [];
let stuckSince = null;
let maxStuck = 0;

for (let sec = 0; sec <= 15 * 60; sec++) {
  // player decisions, once per second
  if (sec === 5) {
    for (let y = 28; y <= 33; y++) b.placePath(20, y);
    b.placeBuilding('decoration', 19, 34);
    w.startExpedition('volcano');
  }
  if (sec === 20) b.placeEnclosure(21, 30, 23, 32, 'lava');
  for (const m of w.monsters.values()) if (m.hunger > 60 && w.wallet.money > 100) w.feedMonster(m.id);
  for (const m of [...w.hatchery.stored]) {
    const free = [...b.enclosures.values()].find((e) => !e.monsterId && e.habitat === { dragonnet: 'lava', yeti: 'ice', kraken: 'water', spectre: 'dark', golem: 'forest' }[m.speciesId]);
    if (free) w.placeStoredMonster(m.id, free.id);
  }
  if (sec === 120 && w.wallet.money > 600) b.placeBuilding('snack', 19, 31);
  if (!w.expeditionBase.active && w.wallet.money > 1500 && w.hatchery.stored.length === 0) {
    const next = ['glacier', 'lagoon', 'crypt'].find((l) => ![...w.monsters.values()].some((m) => m.speciesId === { glacier: 'yeti', lagoon: 'kraken', crypt: 'spectre' }[l]));
    if (next) {
      const hab = { glacier: 'ice', lagoon: 'water', crypt: 'dark' }[next];
      const y0 = { glacier: 27, lagoon: 24, crypt: 21 }[next];
      if (next === 'lagoon') for (let y = 21; y <= 27; y++) b.placePath(20, y);
      if (![...b.enclosures.values()].some((e) => e.habitat === hab)) {
        b.placeEnclosure(21, y0, next === 'lagoon' ? 24 : 23, y0 + 2, hab);
      }
      w.startExpedition(next);
    }
  }

  w.tick(1);
  if (w.wallet.money < 100) stuckSince ??= sec;
  else if (stuckSince !== null) {
    maxStuck = Math.max(maxStuck, sec - stuckSince);
    stuckSince = null;
  }
  for (const e of w.events.splice(0)) log.push(`${String(Math.floor(sec / 60)).padStart(2)}:${String(sec % 60).padStart(2, '0')} ${e.type} ${e.speciesId || e.id || ''}`);
  if (sec % 60 === 0) {
    log.push(`-- ${sec / 60} min: money ${Math.round(w.wallet.money)}, visitors ${w.visitors.length} (total ${w.totalVisitors}), rep ${w.reputation.toFixed(2)}, species ${w.speciesCount()}`);
  }
}
console.log(log.join('\n'));
console.log(`longest time under 100 money: ${maxStuck} s`);
