import { describe, it, expect } from 'vitest';
import {
  createMonster, targetHappiness, updateMonster, escapeChancePerSec, feed, appeal,
} from '../../src/sim/monsters.js';

const enc = (habitat, area) => ({ habitat, area });

describe('monsters', () => {
  it('createMonster defaults', () => {
    const m = createMonster('golem', { rare: false });
    expect(m).toMatchObject({ speciesId: 'golem', rare: false, happiness: 70, hunger: 0, state: 'stored', enclosureId: null });
    expect(m.id).toBeTruthy();
    expect(createMonster('golem').id).not.toBe(m.id);
  });

  it('right habitat, big enough, fed -> target 100', () => {
    expect(targetHappiness(createMonster('golem'), enc('forest', 4), 0)).toBe(100);
  });
  it('wrong habitat -> 30', () => {
    expect(targetHappiness(createMonster('golem'), enc('lava', 4), 0)).toBe(30);
  });
  it('half the minimum area -> 50', () => {
    expect(targetHappiness(createMonster('kraken'), enc('water', 6), 0)).toBe(50);
  });
  it('hunger lowers the target', () => {
    const m = createMonster('golem');
    m.hunger = 40;
    expect(targetHappiness(m, enc('forest', 4), 0)).toBe(80);
  });

  it('happiness falls over 10 minutes when unfed in a bad enclosure', () => {
    const m = createMonster('dragonnet');
    for (let i = 0; i < 600; i++) updateMonster(m, enc('water', 6), 0, 1);
    expect(m.happiness).toBeLessThan(40);
    expect(m.hunger).toBe(100);
  });

  it('happiness rises toward target in a good enclosure', () => {
    const m = createMonster('golem');
    for (let i = 0; i < 60; i++) updateMonster(m, enc('forest', 4), 0, 1);
    expect(m.happiness).toBeGreaterThan(70);
  });

  it('yeti gains happiness with 3+ watchers', () => {
    const a = createMonster('yeti'), b = createMonster('yeti');
    a.happiness = b.happiness = 50;
    a.hunger = b.hunger = 100; // target 50, so only the bonus moves it
    updateMonster(a, enc('ice', 8), 3, 60);
    updateMonster(b, enc('ice', 8), 0, 60);
    expect(a.happiness - b.happiness).toBeCloseTo(5, 0);
  });

  it('escapeChancePerSec', () => {
    const m = createMonster('golem');
    m.happiness = 20;
    expect(escapeChancePerSec(m)).toBe(0);
    m.happiness = 10;
    expect(escapeChancePerSec(m)).toBeCloseTo(0.01);
    const s = createMonster('spectre');
    s.happiness = 10;
    expect(escapeChancePerSec(s)).toBeCloseTo(0.02);
  });

  it('appeal doubles for rare and scales with happiness', () => {
    const m = createMonster('dragonnet');
    m.happiness = 50;
    const r = createMonster('dragonnet', { rare: true });
    r.happiness = 50;
    expect(appeal(m)).toBe(5);
    expect(appeal(r)).toBe(10);
  });

  it('feed resets hunger', () => {
    const m = createMonster('golem');
    m.hunger = 70;
    feed(m);
    expect(m.hunger).toBe(0);
  });
});
