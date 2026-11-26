import { describe, it, expect } from 'vitest';
import { createWanderer, stepWander, findFreeSpot } from '../../src/render/wander.js';
import { createRng } from '../../src/sim/rng.js';

const bounds = { minX: 0, maxX: 6, minY: 0, maxY: 4 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('findFreeSpot', () => {
  it('returns a point inside the bounds, away from the others', () => {
    const rng = createRng(1);
    const others = [{ x: 1, y: 1, r: 0.5 }, { x: 4, y: 3, r: 0.5 }];
    for (let i = 0; i < 50; i++) {
      const p = findFreeSpot(bounds, others, 0.5, rng);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(6);
      for (const o of others) expect(dist(p, o)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('stepWander', () => {
  it('walks to its goal and rests when the way is free', () => {
    const rng = createRng(2);
    const a = createWanderer({ x: 0.5, y: 0.5 }, 0.5);
    a.rest = 0;
    a.goal = { x: 3, y: 0.5 };
    for (let i = 0; i < 100; i++) stepWander(a, [], bounds, 0.1, rng);
    expect(a.goal === null || dist(a, { x: 3, y: 0.5 }) < 0.01).toBe(true);
  });

  it('never walks through a standing monster', () => {
    const rng = createRng(3);
    const rock = { x: 3, y: 2, r: 0.55 };
    const a = createWanderer({ x: 0.5, y: 2 }, 0.55);
    a.rest = 0;
    a.goal = { x: 5.5, y: 2 }; // straight through the other one
    for (let i = 0; i < 3000; i++) {
      stepWander(a, [rock], bounds, 0.05, rng);
      expect(dist(a, rock)).toBeGreaterThanOrEqual(1.1 - 1e-6);
    }
  });

  it('two moving monsters never overlap', () => {
    const rng = createRng(4);
    const a = createWanderer({ x: 1, y: 1 }, 0.55);
    const b = createWanderer({ x: 5, y: 3 }, 0.55);
    for (const w of [a, b]) w.rest = 0;
    let moved = 0;
    for (let i = 0; i < 6000; i++) {
      const ax = a.x;
      stepWander(a, [b], bounds, 0.05, rng);
      stepWander(b, [a], bounds, 0.05, rng);
      if (a.x !== ax) moved++;
      expect(dist(a, b)).toBeGreaterThanOrEqual(1.1 - 1e-6);
    }
    expect(moved).toBeGreaterThan(500); // they still stroll around
  });

  it('a monster that starts on top of another moves away instead of freezing', () => {
    const rng = createRng(5);
    const a = createWanderer({ x: 3, y: 2 }, 0.55);
    const b = { x: 3.2, y: 2, r: 0.55 };
    for (let i = 0; i < 400; i++) stepWander(a, [b], bounds, 0.05, rng);
    expect(dist(a, b)).toBeGreaterThanOrEqual(1.1 - 1e-6);
  });
});
