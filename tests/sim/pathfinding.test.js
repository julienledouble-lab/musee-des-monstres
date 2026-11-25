import { describe, it, expect } from 'vitest';
import { Grid } from '../../src/sim/grid.js';
import { findPath } from '../../src/sim/pathfinding.js';

function line(g, x0, x1, y) {
  for (let x = x0; x <= x1; x++) g.setGround(x, y, 'path');
}

describe('findPath', () => {
  it('straight path with correct length, start excluded, goal included', () => {
    const g = new Grid(10, 10);
    line(g, 0, 5, 0);
    const p = findPath(g, { tx: 0, ty: 0 }, { tx: 5, ty: 0 });
    expect(p).toHaveLength(5);
    expect(p[4]).toEqual({ tx: 5, ty: 0 });
  });

  it('L-shaped path', () => {
    const g = new Grid(10, 10);
    line(g, 0, 3, 0);
    for (let y = 1; y <= 3; y++) g.setGround(3, y, 'path');
    expect(findPath(g, { tx: 0, ty: 0 }, { tx: 3, ty: 3 })).toHaveLength(6);
  });

  it('same tile returns []', () => {
    const g = new Grid(5, 5);
    g.setGround(1, 1, 'path');
    expect(findPath(g, { tx: 1, ty: 1 }, { tx: 1, ty: 1 })).toEqual([]);
  });

  it('null when the path is cut', () => {
    const g = new Grid(10, 10);
    line(g, 0, 5, 0);
    g.setGround(3, 0, 'grass');
    expect(findPath(g, { tx: 0, ty: 0 }, { tx: 5, ty: 0 })).toBeNull();
  });

  it('allowGrass crosses grass but not occupied tiles', () => {
    const g = new Grid(5, 3);
    for (let y = 0; y < 3; y++) if (y !== 2) g.setOccupant(2, y, 'wall');
    const p = findPath(g, { tx: 0, ty: 0 }, { tx: 4, ty: 0 }, { allowGrass: true });
    expect(p).not.toBeNull();
    expect(p.some((s) => s.tx === 2 && s.ty === 2)).toBe(true);
    g.setOccupant(2, 2, 'wall');
    expect(findPath(g, { tx: 0, ty: 0 }, { tx: 4, ty: 0 }, { allowGrass: true })).toBeNull();
  });

  it('allowGrass can always reach the goal even if the goal itself is occupied', () => {
    const g = new Grid(5, 5);
    g.setOccupant(4, 4, 'monster-home');
    expect(findPath(g, { tx: 0, ty: 0 }, { tx: 4, ty: 4 }, { allowGrass: true })).not.toBeNull();
  });
});
