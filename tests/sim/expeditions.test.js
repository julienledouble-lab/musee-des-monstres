import { describe, it, expect } from 'vitest';
import { Wallet } from '../../src/sim/wallet.js';
import { createMonster } from '../../src/sim/monsters.js';
import { ExpeditionBase, Hatchery, placeMonsterInEnclosure } from '../../src/sim/expeditions.js';

const always = (v) => () => v;

describe('ExpeditionBase', () => {
  it('start costs 500 and a second start while active is refused', () => {
    const base = new ExpeditionBase();
    const w = new Wallet(5000);
    expect(base.start('volcano', w).ok).toBe(true);
    expect(w.money).toBe(4500);
    expect(base.start('lagoon', w)).toEqual({ ok: false, reason: 'busy' });
    expect(w.money).toBe(4500);
  });

  it('start refused without money', () => {
    const base = new ExpeditionBase();
    expect(base.start('volcano', new Wallet(100))).toEqual({ ok: false, reason: 'noMoney' });
    expect(base.active).toBeNull();
  });

  it('returns an egg of the location species after durationSec', () => {
    const base = new ExpeditionBase();
    base.start('volcano', new Wallet(5000));
    expect(base.update(59, always(0.5))).toBeNull();
    const egg = base.update(1, always(0.5));
    expect(egg).toMatchObject({ speciesId: 'dragonnet', rare: false, remainingSec: 30, ready: false, locationId: 'volcano' });
    expect(base.active).toBeNull();
  });

  it('egg is rare when rng is below 0.1', () => {
    const base = new ExpeditionBase();
    base.start('glacier', new Wallet(5000));
    expect(base.update(180, always(0.05)).rare).toBe(true);
  });

  it('finishNow completes the expedition immediately', () => {
    const base = new ExpeditionBase();
    base.start('crypt', new Wallet(5000));
    base.finishNow();
    expect(base.update(0.1, always(0.5)).speciesId).toBe('spectre');
  });
});

describe('Hatchery', () => {
  const egg = (speciesId = 'golem') => ({ id: `egg-${speciesId}`, speciesId, rare: false, remainingSec: 30, ready: false });

  it('an egg hatches after 30 s', () => {
    const h = new Hatchery();
    h.addEgg(egg());
    expect(h.update(29)).toEqual([]);
    const born = h.update(1);
    expect(born).toHaveLength(1);
    expect(born[0].speciesId).toBe('golem');
    expect(h.eggs).toHaveLength(0);
    expect(h.stored).toHaveLength(1);
    expect(h.stored[0].state).toBe('stored');
  });

  it('with 3 stored monsters a finished egg stays ready and hatches once a slot frees', () => {
    const h = new Hatchery();
    for (let i = 0; i < 3; i++) h.storeMonster(createMonster('golem'));
    h.addEgg(egg('yeti'));
    h.update(40);
    expect(h.eggs[0].ready).toBe(true);
    expect(h.stored).toHaveLength(3);
    h.takeMonster(h.stored[0].id);
    const born = h.update(0.1);
    expect(born[0].speciesId).toBe('yeti');
    expect(h.eggs).toHaveLength(0);
  });

  it('storeMonster refuses beyond capacity', () => {
    const h = new Hatchery();
    for (let i = 0; i < 3; i++) expect(h.storeMonster(createMonster('golem'))).toBe(true);
    expect(h.storeMonster(createMonster('golem'))).toBe(false);
  });

  it('takeMonster returns null for unknown id', () => {
    expect(new Hatchery().takeMonster('nope')).toBeNull();
  });
});

describe('placeMonsterInEnclosure', () => {
  it('refuses wrong habitat and occupied enclosures', () => {
    const m = createMonster('dragonnet');
    expect(placeMonsterInEnclosure(m, { id: 'e1', habitat: 'water', monsterId: null, x0: 0, y0: 0, x1: 1, y1: 1 }))
      .toEqual({ ok: false, reason: 'wrongHabitat' });
    expect(placeMonsterInEnclosure(m, { id: 'e2', habitat: 'lava', monsterId: 'x', x0: 0, y0: 0, x1: 1, y1: 1 }))
      .toEqual({ ok: false, reason: 'occupied' });
  });

  it('places a monster in a matching empty enclosure', () => {
    const m = createMonster('dragonnet');
    const e = { id: 'e3', habitat: 'lava', monsterId: null, x0: 2, y0: 2, x1: 4, y1: 4 };
    expect(placeMonsterInEnclosure(m, e).ok).toBe(true);
    expect(e.monsterId).toBe(m.id);
    expect(m).toMatchObject({ state: 'enclosed', enclosureId: 'e3', pos: { x: 3, y: 3 } });
  });
});
