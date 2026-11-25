import { describe, it, expect } from 'vitest';
import { Grid } from '../../src/sim/grid.js';
import { Wallet } from '../../src/sim/wallet.js';
import { Builder } from '../../src/sim/build.js';
import { createMonster } from '../../src/sim/monsters.js';
import { createVisitor } from '../../src/sim/visitors.js';
import { createRng } from '../../src/sim/rng.js';
import {
  hireKeeper, escapeMonster, updateEscaped, updateKeeper, catchByClick,
} from '../../src/sim/staff.js';

function setup() {
  const grid = new Grid(20, 20);
  const wallet = new Wallet(5000);
  const builder = new Builder(grid, wallet);
  const r = builder.placeEnclosure(5, 5, 6, 6, 'lava');
  const enclosure = builder.enclosures.get(r.id);
  const m = createMonster('dragonnet');
  m.state = 'enclosed';
  m.enclosureId = r.id;
  enclosure.monsterId = m.id;
  const monsters = new Map([[m.id, m]]);
  const keepers = [];
  const ctx = { grid, wallet, builder, monsters, keepers, visitors: [], rng: createRng(5), stored: [] };
  ctx.storeMonster = (mon) => { ctx.stored.push(mon); return true; };
  return { ctx, m, enclosure };
}

describe('staff', () => {
  it('hireKeeper costs 300 and spawns on the tile', () => {
    const { ctx } = setup();
    const r = hireKeeper(ctx.keepers, ctx.wallet, { tx: 0, ty: 0 });
    expect(r.ok).toBe(true);
    expect(ctx.wallet.money).toBe(5000 - 200 - 300);
    expect(ctx.keepers[0].pos).toEqual({ x: 0, y: 0 });
  });

  it('hireKeeper refused without money', () => {
    const { ctx } = setup();
    ctx.wallet.charge(10000);
    expect(hireKeeper(ctx.keepers, ctx.wallet, { tx: 0, ty: 0 })).toEqual({ ok: false, reason: 'noMoney' });
  });

  it('escapeMonster puts the monster on a free tile outside its enclosure', () => {
    const { ctx, m, enclosure } = setup();
    expect(escapeMonster(m, enclosure, ctx.grid)).toBe(true);
    expect(m.state).toBe('escaped');
    const inside = m.pos.x >= 5 && m.pos.x <= 6 && m.pos.y >= 5 && m.pos.y <= 6;
    expect(inside).toBe(false);
    expect(ctx.grid.getTile(m.pos.x, m.pos.y).occupant).toBeNull();
  });

  it('an escaped monster next to a visitor scares it', () => {
    const { ctx, m, enclosure } = setup();
    escapeMonster(m, enclosure, ctx.grid);
    const v = createVisitor({ tx: m.pos.x + 1, ty: m.pos.y });
    ctx.visitors.push(v);
    updateEscaped(m, ctx, 0.1);
    expect(v.state).toBe('fleeing');
  });

  it('a keeper catches and returns an escaped monster on an open grid', () => {
    const { ctx, m, enclosure } = setup();
    hireKeeper(ctx.keepers, ctx.wallet, { tx: 15, ty: 15 });
    escapeMonster(m, enclosure, ctx.grid);
    m.happiness = 10;
    let caughtAt = null;
    for (let i = 0; i < 600; i++) {
      updateEscaped(m, ctx, 0.1);
      updateKeeper(ctx.keepers[0], ctx, 0.1);
      if (m.state === 'enclosed') { caughtAt = i / 10; break; }
    }
    expect(caughtAt).not.toBeNull();
    expect(caughtAt).toBeLessThan(30);
    expect(m.happiness).toBe(30);
    expect(ctx.keepers[0].state).toBe('patrol');
  });

  it('two keepers never target the same monster', () => {
    const { ctx, m, enclosure } = setup();
    hireKeeper(ctx.keepers, ctx.wallet, { tx: 15, ty: 15 });
    hireKeeper(ctx.keepers, ctx.wallet, { tx: 0, ty: 15 });
    escapeMonster(m, enclosure, ctx.grid);
    updateKeeper(ctx.keepers[0], ctx, 0.1);
    updateKeeper(ctx.keepers[1], ctx, 0.1);
    expect(ctx.keepers[0].targetMonsterId).toBe(m.id);
    expect(ctx.keepers[1].targetMonsterId).toBeNull();
  });

  it('catchByClick returns the monster with +20 happiness', () => {
    const { ctx, m, enclosure } = setup();
    escapeMonster(m, enclosure, ctx.grid);
    m.happiness = 5;
    catchByClick(m, ctx);
    expect(m.state).toBe('enclosed');
    expect(m.happiness).toBe(25);
  });

  it('a caught monster whose enclosure is gone goes to the hatchery', () => {
    const { ctx, m, enclosure } = setup();
    escapeMonster(m, enclosure, ctx.grid);
    enclosure.monsterId = null;
    ctx.builder.demolish(5, 5);
    catchByClick(m, ctx);
    expect(m.state).toBe('stored');
    expect(ctx.stored).toContain(m);
  });
});
