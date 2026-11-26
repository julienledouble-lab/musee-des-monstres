import Phaser from 'phaser';
import { tileToScreen, screenToTile } from '../sim/iso.js';
import { generateTextures } from './textures.js';
import {
  preloadSprites, resolveMonsterTexture, realKey, directionIndex, DIRECTIONAL_ORIGIN_Y,
} from './sprites.js';
import { capacity } from '../sim/breeding.js';

const GROUND_DEPTH = -1e6;
const FENCE_DEPTH = -5e5;
const GHOST_DEPTH = 1e6;
const FENCE_COLOR = 0x8a6038;
const FENCE_SHADE = 0x3e2a17;

// Draws the World and turns pointer input into World / Builder calls.
// The current tool is set by the DOM UI through setTool().
export class GameScene extends Phaser.Scene {
  constructor(world, ui) {
    super('game');
    this.world = world;
    this.ui = ui;
    this.tool = { type: 'select' };
  }

  preload() {
    preloadSprites(this);
  }

  create() {
    generateTextures(this);
    const { grid } = this.world;

    this.tileImages = [];
    for (let ty = 0; ty < grid.h; ty++) {
      for (let tx = 0; tx < grid.w; tx++) {
        const p = tileToScreen(tx, ty);
        this.tileImages.push(this.add.image(p.x, p.y, 'tile-grass').setDepth(GROUND_DEPTH));
      }
    }
    this.fences = this.add.graphics().setDepth(FENCE_DEPTH);
    this.ghost = this.add.graphics().setDepth(GHOST_DEPTH);
    this.buildingSprites = new Map();
    this.entitySprites = new Map(); // id -> { sprite, bubble, kind }
    this.lastGridVersion = -1;

    this.cameras.main.setZoom(1.2);
    this.centerView();
    this.scale.on('resize', () => {
      if (!this.userMovedCamera) this.centerView();
    });

    this.setupInput();
    this.ui.bindScene(this);
  }

  setTool(tool) {
    this.tool = tool;
    this.dragStart = null;
    this.ghost.clear();
  }

  // ---- frame ------------------------------------------------------------

  update(time, delta) {
    if (!this.centeredOnce) {
      this.centeredOnce = true;
      this.centerView();
    }
    this.world.tick(Math.min(delta / 1000, 1));
    for (const e of this.world.events.splice(0)) this.ui.onEvent(e);
    if (this.world.grid.version !== this.lastGridVersion) {
      this.lastGridVersion = this.world.grid.version;
      this.redrawGround();
    }
    this.syncEntities(time);
    this.moveCameraWithKeys(delta);
    this.ui.update();
  }

  redrawGround() {
    const { grid, builder } = this.world;
    for (let ty = 0; ty < grid.h; ty++) {
      for (let tx = 0; tx < grid.w; tx++) {
        const t = grid.getTile(tx, ty);
        let key = (tx * 7 + ty * 13) % 5 === 0 ? 'tile-grass2' : 'tile-grass';
        if (t.ground === 'path') key = tx === this.world.entrance.tx && ty === this.world.entrance.ty ? 'tile-entrance' : 'tile-path';
        const enc = t.occupant && builder.enclosures.get(t.occupant);
        if (enc) key = `tile-${enc.habitat}`;
        const img = this.tileImages[ty * grid.w + tx];
        const rk = realKey(this, key);
        // real tiles have soft anti-aliased edges: overlap them by a pixel so no seam shows
        img.setTexture(rk).setDisplaySize(rk === key ? 64 : 66, rk === key ? 32 : 33);
      }
    }

    // wooden fence: a post at every tile corner and two rails between posts
    this.fences.clear();
    const f = this.fences;
    for (const e of builder.enclosures.values()) {
      const corners = [[e.x0 - 0.5, e.y0 - 0.5], [e.x1 + 0.5, e.y0 - 0.5], [e.x1 + 0.5, e.y1 + 0.5], [e.x0 - 0.5, e.y1 + 0.5]];
      const posts = [];
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4];
        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let s = 0; s < steps; s++) posts.push(tileToScreen(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps));
      }
      for (const [h, w] of [[4, 3], [10, 3]]) {
        f.lineStyle(w + 2, FENCE_SHADE, 1);
        f.strokePoints(posts.map((p) => ({ x: p.x, y: p.y - h })), true);
        f.lineStyle(w, FENCE_COLOR, 1);
        f.strokePoints(posts.map((p) => ({ x: p.x, y: p.y - h - 0.5 })), true);
      }
      for (const p of posts) {
        f.fillStyle(FENCE_SHADE, 1);
        f.fillRect(p.x - 2.5, p.y - 15, 5, 16);
        f.fillStyle(FENCE_COLOR, 1);
        f.fillRect(p.x - 2.5, p.y - 15, 3, 15);
      }
    }

    const alive = new Set();
    for (const b of builder.buildings.values()) {
      alive.add(b.id);
      if (this.buildingSprites.has(b.id)) continue;
      const big = b.x1 > b.x0;
      const center = big ? tileToScreen(b.x0 + 0.5, b.y0 + 0.5) : tileToScreen(b.x0, b.y0);
      const key = realKey(this, b.type);
      let s;
      if (key !== b.type) {
        // Blender render: the tile centre sits 16 px (per tile) above the image bottom
        s = this.add.image(center.x, center.y + (big ? 32 : 16), key).setOrigin(0.5, 1);
        s.setDisplaySize(big ? 128 : 64, big ? 160 : 96);
      } else {
        s = this.add.image(center.x, center.y + (big ? 14 : 8), b.type).setOrigin(0.5, 1);
      }
      s.setDepth(tileToScreen(b.x1, b.y1).y);
      this.buildingSprites.set(b.id, s);
    }
    for (const [id, s] of this.buildingSprites) {
      if (!alive.has(id)) {
        s.destroy();
        this.buildingSprites.delete(id);
      }
    }
  }

  syncEntities(time) {
    const { world } = this;
    const alive = new Set();

    for (const m of world.monsters.values()) {
      if (m.state === 'stored') continue;
      alive.add(m.id);
      const entry0 = this.entitySprites.get(m.id);
      const look = resolveMonsterTexture(this, m, entry0 ? entry0.dir : 0);
      const entry = this.entry(m.id, 'monster', look.key);
      if (entry.sprite.texture.key !== look.key) entry.sprite.setTexture(look.key);
      if (look.tint) entry.sprite.setTint(look.tint);
      else entry.sprite.clearTint();
      if (!entry.shadow) entry.shadow = this.add.image(0, 0, 'shadow');
      let x = m.pos.x, y = m.pos.y;
      if (m.state === 'enclosed') {
        const e = world.builder.enclosures.get(m.enclosureId);
        if (e) {
          const phase = entry.phase;
          const hx = Math.max(0, (e.x1 - e.x0) / 2 - 0.2);
          const hy = Math.max(0, (e.y1 - e.y0) / 2 - 0.2);
          x += Math.sin(time * 0.0004 + phase) * hx;
          y += Math.sin(time * 0.00031 + phase * 2) * hy;
        }
      }
      const p = tileToScreen(x, y);
      // turn toward the walking direction (tile-space movement since last frame)
      const mdx = x - (entry.lastTX ?? x), mdy = y - (entry.lastTY ?? y);
      entry.lastTX = x;
      entry.lastTY = y;
      const moving = Math.hypot(mdx, mdy) > 0.0015;
      if (look.directional) {
        if (moving) entry.dir = directionIndex(mdx, mdy);
        entry.sprite.setFlipX(false).setOrigin(0.5, DIRECTIONAL_ORIGIN_Y);
      } else {
        const dx = p.x - entry.lastX;
        // single real images face left, procedural ones face the viewer: flip toward the walking direction
        if (Math.abs(dx) > 0.05) entry.sprite.setFlipX(look.real ? dx > 0 : dx < 0);
        entry.sprite.setOrigin(0.5, 1);
      }
      entry.lastX = p.x;
      const bob = Math.abs(Math.sin(time * 0.006 + entry.phase)) * (look.real ? 1.2 : 3);
      entry.sprite.setPosition(p.x, p.y + (look.directional ? 0 : 8) - bob).setDepth(p.y);
      const pulse = m.state === 'escaped' ? 1 + 0.08 * Math.sin(time * 0.02) : 1;
      entry.sprite.setScale(look.scale * pulse);
      let shadow = [0.7, 0.7];
      if (look.directional) shadow = [1.3, 1.0];
      else if (look.real) shadow = [(entry.sprite.displayWidth / 64) * 0.9, 0.9];
      entry.shadow.setPosition(p.x, p.y + (look.directional ? 1 : 6)).setDepth(p.y - 0.5).setScale(shadow[0], shadow[1]);
      const top = look.directional ? entry.sprite.displayHeight * DIRECTIONAL_ORIGIN_Y : entry.sprite.displayHeight;
      this.setBubble(entry, m.state === 'escaped' ? 'bubble-scared' : null, p, top - 10);
    }

    for (const v of world.visitors) {
      alive.add(v.id);
      const entry = this.entry(v.id, 'visitor', `visitor-${v.variant}`);
      const p = tileToScreen(v.pos.x, v.pos.y);
      const walking = v.state === 'walking' || v.state === 'leaving' || v.state === 'fleeing';
      const bob = walking ? Math.abs(Math.sin(time * 0.015 + entry.phase)) * 2 : 0;
      entry.sprite.setPosition(p.x, p.y + 6 - bob).setDepth(p.y);
      let bubble = null;
      if (v.mood !== 'happy') bubble = `bubble-${v.mood}`;
      else if (v.state === 'watching') bubble = 'bubble-happy';
      this.setBubble(entry, bubble, p, 40);
    }

    for (const k of world.keepers) {
      alive.add(k.id);
      const entry = this.entry(k.id, 'keeper', 'keeper');
      const p = tileToScreen(k.pos.x, k.pos.y);
      entry.sprite.setPosition(p.x, p.y + 6).setDepth(p.y);
    }

    for (const [id, entry] of this.entitySprites) {
      if (alive.has(id)) continue;
      entry.sprite.destroy();
      if (entry.bubble) entry.bubble.destroy();
      if (entry.shadow) entry.shadow.destroy();
      this.entitySprites.delete(id);
    }
  }

  entry(id, kind, texture) {
    let e = this.entitySprites.get(id);
    if (!e) {
      const sprite = this.add.image(0, 0, texture).setOrigin(0.5, 1);
      e = { sprite, bubble: null, kind, phase: Math.random() * 10, lastX: 0, dir: 0 };
      this.entitySprites.set(id, e);
    }
    return e;
  }

  setBubble(entry, key, p, height) {
    if (!key) {
      if (entry.bubble) entry.bubble.setVisible(false);
      return;
    }
    if (!entry.bubble) entry.bubble = this.add.image(0, 0, key);
    entry.bubble.setTexture(key).setVisible(true).setPosition(p.x + 10, p.y - height).setDepth(p.y + 1);
  }

  // ---- camera -----------------------------------------------------------

  centerView() {
    const start = tileToScreen(20, 34);
    this.cameras.main.centerOn(start.x, start.y);
  }

  moveCameraWithKeys(delta) {
    const cam = this.cameras.main;
    const speed = (0.6 * delta) / cam.zoom;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown || k.q.isDown) cam.scrollX -= speed;
    if (k.right.isDown || k.d.isDown) cam.scrollX += speed;
    if (k.up.isDown || k.w.isDown || k.z.isDown) cam.scrollY -= speed;
    if (k.down.isDown || k.s.isDown) cam.scrollY += speed;
  }

  // ---- input ------------------------------------------------------------

  setupInput() {
    this.input.mouse.disableContextMenu();
    this.keys = this.input.keyboard.addKeys('up,down,left,right,w,a,s,d,z,q');
    this.input.keyboard.on('keydown-ESC', () => this.ui.setTool({ type: 'select' }));

    this.input.on('wheel', (pointer, objs, dx, dy) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 2));
    });

    this.input.on('pointerdown', (pointer) => {
      this.downAt = { x: pointer.x, y: pointer.y };
      this.panning = false;
      if (!pointer.leftButtonDown()) return;
      const tile = this.pointerTile(pointer);
      if (this.tool.type === 'enclosure') this.dragStart = tile;
      if (this.tool.type === 'path') {
        this.lastPainted = null;
        this.paintPath(tile);
      }
    });

    this.input.on('pointermove', (pointer) => {
      const cam = this.cameras.main;
      const rightDrag = pointer.rightButtonDown() || pointer.middleButtonDown();
      const leftPan = pointer.leftButtonDown() && this.tool.type === 'select' && this.downAt
        && Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, pointer.x, pointer.y) > 6;
      if (rightDrag || leftPan) {
        this.panning = true;
        this.userMovedCamera = true;
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
        return;
      }
      const tile = this.pointerTile(pointer);
      if (this.tool.type === 'path' && pointer.leftButtonDown()) this.paintPath(tile);
      this.drawGhost(tile);
    });

    this.input.on('pointerup', (pointer) => {
      if (pointer.button !== 0 || pointer.downElement !== this.game.canvas) return;
      const tile = this.pointerTile(pointer);
      if (this.panning) {
        this.panning = false;
        return;
      }
      this.handleClick(tile, pointer);
    });
  }

  pointerTile(pointer) {
    const p = pointer.positionToCamera(this.cameras.main);
    return screenToTile(p.x, p.y);
  }

  report(result) {
    if (!result.ok) this.ui.error(result.reason);
    return result;
  }

  // Paints every tile between the last painted tile and this one (4-connected),
  // so fast mouse moves leave no holes.
  paintPath(tile) {
    const last = this.lastPainted;
    this.lastPainted = { ...tile };
    const cells = [];
    if (last) {
      let { tx, ty } = last;
      while (tx !== tile.tx || ty !== tile.ty) {
        if (Math.abs(tile.tx - tx) >= Math.abs(tile.ty - ty)) tx += Math.sign(tile.tx - tx);
        else ty += Math.sign(tile.ty - ty);
        cells.push({ tx, ty });
      }
    } else cells.push(tile);
    for (const c of cells) {
      if (this.world.grid.isPath(c.tx, c.ty)) continue;
      const r = this.world.builder.placePath(c.tx, c.ty);
      if (!r.ok && r.reason !== 'outOfBounds') this.report(r);
    }
  }

  handleClick(tile, pointer) {
    const { world } = this;
    const b = world.builder;
    this.lastPainted = null;
    switch (this.tool.type) {
      case 'enclosure': {
        if (this.dragStart) this.report(b.placeEnclosure(this.dragStart.tx, this.dragStart.ty, tile.tx, tile.ty, this.tool.habitat));
        this.dragStart = null;
        break;
      }
      case 'decoration':
      case 'snack':
      case 'souvenir':
        this.report(b.placeBuilding(this.tool.type, tile.tx, tile.ty));
        break;
      case 'demolish':
        this.report(b.demolish(tile.tx, tile.ty));
        break;
      case 'placeMonster': {
        const t = world.grid.getTile(tile.tx, tile.ty);
        const enc = t && t.occupant && b.enclosures.get(t.occupant);
        if (!enc) {
          this.ui.error('wrongHabitat');
          break;
        }
        if (this.report(world.placeStoredMonster(this.tool.monsterId, enc.id)).ok) {
          this.ui.setTool({ type: 'select' });
          this.ui.select({ kind: 'monster', id: this.tool.monsterId });
        }
        break;
      }
      case 'select':
        this.selectAt(tile, pointer);
        break;
      default:
        break;
    }
    this.drawGhost(tile);
  }

  selectAt(tile, pointer) {
    const { world } = this;
    const p = pointer.positionToCamera(this.cameras.main);
    // sprites first (escaped monsters are clickable to catch them)
    let best = null;
    for (const [id, e] of this.entitySprites) {
      if (!e.sprite.getBounds().contains(p.x, p.y)) continue;
      if (!best || e.sprite.depth > best.e.sprite.depth || (e.kind === 'monster' && best.e.kind !== 'monster')) best = { id, e };
    }
    if (best && best.e.kind === 'monster') {
      const m = world.monsters.get(best.id);
      if (m && m.state === 'escaped') {
        world.catchMonster(m.id);
        this.ui.onEvent({ type: 'caught', speciesId: m.speciesId });
        return;
      }
      this.ui.select({ kind: 'monster', id: best.id });
      return;
    }
    if (best && best.e.kind === 'visitor') {
      this.ui.select({ kind: 'visitor', id: best.id });
      return;
    }
    // building sprites are taller than their tiles: test their image bounds too
    let bestB = null;
    for (const [id, s] of this.buildingSprites) {
      if (s.getBounds().contains(p.x, p.y) && (!bestB || s.depth > bestB.s.depth)) bestB = { id, s };
    }
    if (bestB) {
      const bld = world.builder.buildings.get(bestB.id);
      if (bld) {
        this.ui.select({ kind: 'building', id: bld.id, type: bld.type });
        return;
      }
    }
    const t = world.grid.getTile(tile.tx, tile.ty);
    if (!t || !t.occupant) {
      this.ui.select(null);
      return;
    }
    const enc = world.builder.enclosures.get(t.occupant);
    if (enc) {
      this.ui.select({ kind: 'enclosure', id: enc.id });
      return;
    }
    const bld = world.builder.buildings.get(t.occupant);
    if (bld) this.ui.select({ kind: 'building', id: bld.id, type: bld.type });
  }

  drawGhost(tile) {
    const g = this.ghost;
    g.clear();
    const { grid } = this.world;
    const type = this.tool.type;
    if (type === 'select') return;
    const diamondAt = (tx, ty, ok) => {
      const c = tileToScreen(tx, ty);
      const pts = [{ x: c.x, y: c.y - 16 }, { x: c.x + 32, y: c.y }, { x: c.x, y: c.y + 16 }, { x: c.x - 32, y: c.y }];
      g.fillStyle(ok ? 0x52b788 : 0xe63946, 0.45);
      g.fillPoints(pts, true);
    };
    if (type === 'enclosure' && this.dragStart) {
      const x0 = Math.min(this.dragStart.tx, tile.tx), x1 = Math.max(this.dragStart.tx, tile.tx);
      const y0 = Math.min(this.dragStart.ty, tile.ty), y1 = Math.max(this.dragStart.ty, tile.ty);
      let ok = x1 > x0 && y1 > y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!grid.isFree(x, y)) ok = false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (grid.inBounds(x, y)) diamondAt(x, y, ok);
      this.ui.hint(`${(x1 - x0 + 1)} × ${(y1 - y0 + 1)}`);
      return;
    }
    if (!grid.inBounds(tile.tx, tile.ty)) return;
    if (type === 'demolish') {
      const t = grid.getTile(tile.tx, tile.ty);
      diamondAt(tile.tx, tile.ty, false);
      if (!t.occupant && t.ground !== 'path') g.clear();
      return;
    }
    if (type === 'placeMonster') {
      const t = grid.getTile(tile.tx, tile.ty);
      const enc = t.occupant && this.world.builder.enclosures.get(t.occupant);
      const sp = this.tool.speciesId;
      const ok = !!enc && enc.habitat === this.tool.habitat
        && (enc.monsterIds.length === 0 || enc.speciesId === sp)
        && enc.monsterIds.length < capacity(enc, sp);
      diamondAt(tile.tx, tile.ty, ok);
      return;
    }
    diamondAt(tile.tx, tile.ty, grid.isFree(tile.tx, tile.ty));
  }
}
