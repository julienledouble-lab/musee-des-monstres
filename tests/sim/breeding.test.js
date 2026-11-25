import { describe, it, expect } from 'vitest';
import { capacity, rollBabyRare } from '../../src/sim/breeding.js';
import { createMonster, targetHappiness } from '../../src/sim/monsters.js';
import { placeMonsterInEnclosure } from '../../src/sim/expeditions.js';
import { createInitialWorld } from '../../src/sim/world.js';

const enc = (habitat, area, extra = {}) => ({ id: 'e', habitat, area, monsterIds: [], speciesId: null, x0: 0, y0: 0, x1: 1, y1: 1, ...extra });

describe('capacity', () => {
  it('is area / minArea, at least 1', () => {
    expect(capacity(enc('lava', 12), 'dragonnet')).toBe(2);
    expect(capacity(enc('lava', 17), 'dragonnet')).toBe(2);
    expect(capacity(enc('forest', 6), 'golem')).toBe(1);
    expect(capacity(enc('water', 4), 'kraken')).toBe(1);
  });
});

describe('several monsters per enclosure', () => {
  it('accepts monsters up to capacity, then refuses with full', () => {
    const e = enc('lava', 12);
    expect(placeMonsterInEnclosure(createMonster('dragonnet'), e).ok).toBe(true);
    expect(placeMonsterInEnclosure(createMonster('dragonnet'), e).ok).toBe(true);
    expect(placeMonsterInEnclosure(createMonster('dragonnet'), e)).toEqual({ ok: false, reason: 'full' });
    expect(e.monsterIds).toHaveLength(2);
    expect(e.speciesId).toBe('dragonnet');
  });

  it('refuses another species', () => {
    const e = enc('lava', 24, { speciesId: 'kraken', monsterIds: ['x'] });
    expect(placeMonsterInEnclosure(createMonster('dragonnet'), e)).toEqual({ ok: false, reason: 'otherSpecies' });
  });

  it('crowding lowers happiness: 2 dragonnets in 6 tiles -> target 50', () => {
    const e = enc('lava', 6, { monsterIds: ['a', 'b'] });
    expect(targetHappiness(createMonster('dragonnet'), e, 0)).toBe(50);
  });
});

describe('rollBabyRare', () => {
  it('10 % normally, 50 % with a rare parent', () => {
    const normal = [createMonster('golem'), createMonster('golem')];
    const rareParent = [createMonster('golem', { rare: true }), createMonster('golem')];
    expect(rollBabyRare(normal, () => 0.3)).toBe(false);
    expect(rollBabyRare(normal, () => 0.05)).toBe(true);
    expect(rollBabyRare(rareParent, () => 0.3)).toBe(true);
    expect(rollBabyRare(rareParent, () => 0.6)).toBe(false);
  });
});

function worldWithPair(area = 18) {
  const w = createInitialWorld(3);
  w.setTicketPrice(100);
  const x1 = 24 + (area / 3) - 1;
  const r = w.builder.placeEnclosure(24, 30, x1, 32, 'lava');
  const e = w.builder.enclosures.get(r.id);
  const pair = [createMonster('dragonnet'), createMonster('dragonnet')];
  for (const m of pair) {
    m.happiness = 90;
    w.monsters.set(m.id, m);
    placeMonsterInEnclosure(m, e);
  }
  return { w, e, pair };
}

describe('breeding in the world', () => {
  it('two happy fed adults lay an egg after 3 min; the baby joins its parents', () => {
    const { w, e } = worldWithPair(18); // capacity 3
    for (let i = 0; i < 1790; i++) w.tick(0.1);
    expect(w.hatchery.eggs).toHaveLength(0);
    for (let i = 0; i < 20; i++) w.tick(0.1);
    expect(w.events.some((ev) => ev.type === 'laid' && ev.speciesId === 'dragonnet')).toBe(true);
    expect(w.hatchery.eggs).toHaveLength(1);
    for (let i = 0; i < 310; i++) w.tick(0.1);
    expect(e.monsterIds).toHaveLength(3);
    expect(w.hatchery.stored).toHaveLength(0);
    expect(e.breedTimer).toBeLessThan(40);
  });

  it('no egg when the enclosure is full', () => {
    const { w } = worldWithPair(12); // capacity 2
    for (let i = 0; i < 2400; i++) w.tick(0.1);
    expect(w.hatchery.eggs).toHaveLength(0);
  });

  it('no egg when the parents are unhappy', () => {
    const { w, e, pair } = worldWithPair(18);
    e.habitat = 'water'; // wrong habitat: happiness keeps dropping
    for (const m of pair) m.happiness = 60;
    for (let i = 0; i < 2400; i++) w.tick(0.1);
    expect(w.events.some((ev) => ev.type === 'laid')).toBe(false);
  });

  it('only one egg at a time per free place', () => {
    const { w } = worldWithPair(18); // capacity 3: room for one baby
    for (let i = 0; i < 3700; i++) {
      w.tick(0.1);
      for (const m of w.monsters.values()) m.hunger = 0;
    }
    const laid = w.events.filter((ev) => ev.type === 'laid').length;
    expect(laid).toBe(1);
  });

  it('demolishing an enclosure with 2 monsters needs 2 hatchery slots', () => {
    const { w, e } = worldWithPair(18);
    w.hatchery.storeMonster(createMonster('yeti'));
    w.hatchery.storeMonster(createMonster('yeti'));
    expect(w.builder.demolish(e.x0, e.y0)).toEqual({ ok: false, reason: 'enclosureNotEmpty' });
    w.hatchery.takeMonster(w.hatchery.stored[0].id);
    expect(w.builder.demolish(e.x0, e.y0).ok).toBe(true);
    expect(w.hatchery.stored.filter((m) => m.speciesId === 'dragonnet')).toHaveLength(2);
  });
});
