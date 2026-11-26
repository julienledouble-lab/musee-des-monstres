import { describe, it, expect } from 'vitest';
import { directionIndex } from '../../src/render/sprites.js';

// d0 faces +ty (screen bottom-left); each index turns 45 degrees (Blender rotation around Z).
describe('directionIndex', () => {
  it('maps the 8 tile-space directions to 0..7', () => {
    expect(directionIndex(0, 1)).toBe(0);
    expect(directionIndex(1, 1)).toBe(1);
    expect(directionIndex(1, 0)).toBe(2);
    expect(directionIndex(1, -1)).toBe(3);
    expect(directionIndex(0, -1)).toBe(4);
    expect(directionIndex(-1, -1)).toBe(5);
    expect(directionIndex(-1, 0)).toBe(6);
    expect(directionIndex(-1, 1)).toBe(7);
  });

  it('snaps in-between angles to the nearest direction', () => {
    expect(directionIndex(0.1, 1)).toBe(0);
    expect(directionIndex(-0.1, 1)).toBe(0);
    expect(directionIndex(1, 0.2)).toBe(2);
  });
});
