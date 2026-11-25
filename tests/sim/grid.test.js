import { describe, it, expect } from 'vitest';
import { tileToScreen, screenToTile } from '../../src/sim/iso.js';
import { Grid } from '../../src/sim/grid.js';
import { createRng } from '../../src/sim/rng.js';

describe('iso', () => {
  it('screenToTile inverts tileToScreen', () => {
    const rng = createRng(7);
    for (let i = 0; i < 20; i++) {
      const tx = Math.floor(rng() * 40), ty = Math.floor(rng() * 40);
      const { x, y } = tileToScreen(tx, ty);
      expect(screenToTile(x, y)).toEqual({ tx, ty });
    }
  });
  it('tile center formula', () => {
    expect(tileToScreen(2, 1)).toEqual({ x: 32, y: 48 });
  });
});

describe('Grid', () => {
  it('bounds', () => {
    const g = new Grid(40, 40);
    expect(g.inBounds(-1, 0)).toBe(false);
    expect(g.inBounds(39, 39)).toBe(true);
    expect(g.inBounds(40, 0)).toBe(false);
  });
  it('neighbors4 of a corner has 2 tiles', () => {
    expect(new Grid(40, 40).neighbors4(0, 0)).toHaveLength(2);
  });
  it('isFree false when occupied or path', () => {
    const g = new Grid(10, 10);
    expect(g.isFree(1, 1)).toBe(true);
    g.setOccupant(1, 1, 'x');
    expect(g.isFree(1, 1)).toBe(false);
    g.setGround(2, 2, 'path');
    expect(g.isFree(2, 2)).toBe(false);
    expect(g.getTile(2, 2)).toEqual({ ground: 'path', occupant: null });
  });
});
