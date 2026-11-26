// Realistic monster images (prepared with scripts/prepare_sprite.py).
// Every PNG in src/assets/sprites is picked up: "<speciesId>.png" and "<speciesId>-rare.png".
const files = import.meta.glob('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });

export const SPRITE_URLS = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url]),
);

// Display scale of a 256 px sprite, per species (how big the monster looks on the map).
export const SPRITE_SCALE = { dragonnet: 0.42, kraken: 0.4, spectre: 0.38, golem: 0.36, yeti: 0.38 };

// Tint used for a rare monster when only the normal image exists.
export const RARE_FALLBACK_TINT = 0xffd36b;

// Realistic ground tiles and buildings rendered in Blender (2x the in-game size).
// Their file name is the procedural texture key they replace: tile-grass.png, bld-snack.png...
const decor = import.meta.glob(['../assets/tiles/*.png', '../assets/buildings/*.png'], { eager: true, query: '?url', import: 'default' });
export const DECOR_URLS = Object.fromEntries(
  Object.entries(decor).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url]),
);

// Animated 3D models: horizontal strips of 256 px frames, "<speciesId>-<walk|idle>-d<0..7>.png".
const animFiles = import.meta.glob('../assets/anims/*.png', { eager: true, query: '?url', import: 'default' });
export const ANIM_URLS = Object.fromEntries(
  Object.entries(animFiles).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url]),
);
// Playback speed of each animation (frames per second of the sampled strip).
const ANIM_FPS = { walk: 8, idle: 3 };

export function preloadSprites(scene) {
  for (const [name, url] of Object.entries(SPRITE_URLS)) scene.load.image(`real-${name}`, url);
  for (const [name, url] of Object.entries(DECOR_URLS)) scene.load.image(`img-${name}`, url);
  for (const [name, url] of Object.entries(ANIM_URLS)) {
    scene.load.spritesheet(`anim-${name}`, url, { frameWidth: 256, frameHeight: 256 });
  }
}

// Called once after loading: one looping Phaser animation per strip (same key as the strip).
export function createAnimations(scene) {
  for (const name of Object.keys(ANIM_URLS)) {
    const kind = name.includes('-walk-') ? 'walk' : 'idle';
    if (scene.anims.exists(name)) continue;
    scene.anims.create({
      key: name,
      frames: scene.anims.generateFrameNumbers(`anim-${name}`),
      frameRate: ANIM_FPS[kind],
      repeat: -1,
    });
  }
}

export function hasAnimation(scene, speciesId) {
  return scene.anims.exists(`${speciesId}-walk-d0`) && scene.anims.exists(`${speciesId}-idle-d0`);
}

// The realistic version of a procedural texture key if one was loaded, else the key itself.
// Buildings are looked up as "bld-<type>".
export function realKey(scene, key) {
  if (scene.textures.exists(`img-${key}`)) return `img-${key}`;
  if (scene.textures.exists(`img-bld-${key}`)) return `img-bld-${key}`;
  return key;
}

// 3D models rendered in Blender in 8 directions: "<speciesId>-d0.png" ... "-d7.png" (256 px, 2x scale,
// feet centre 40 px above the bottom). d0 faces +ty (screen bottom-left), each next one turns 45 deg.
export const DIRECTIONAL_SCALE = 0.5;
export const DIRECTIONAL_ORIGIN_Y = 216 / 256;

// Direction index 0..7 for a movement (dx, dy) in tile units.
export function directionIndex(dx, dy) {
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return ((Math.round(deg / 45) % 8) + 8) % 8;
}

// Which texture to draw a monster with: { key, tint, real, scale, directional }.
export function resolveMonsterTexture(scene, monster, dir = 0) {
  const base = monster.speciesId;
  const has = (k) => scene.textures.exists(`real-${k}`);
  if (has(`${base}-d0`)) {
    const rareDir = monster.rare && has(`${base}-rare-d0`);
    return {
      key: `real-${base}${rareDir ? '-rare' : ''}-d${dir}`,
      tint: monster.rare && !rareDir ? RARE_FALLBACK_TINT : null,
      real: true,
      directional: true,
      scale: DIRECTIONAL_SCALE,
    };
  }
  if (monster.rare && has(`${base}-rare`)) return { key: `real-${base}-rare`, tint: null, real: true, scale: SPRITE_SCALE[base] };
  if (has(base)) {
    return { key: `real-${base}`, tint: monster.rare ? RARE_FALLBACK_TINT : null, real: true, scale: SPRITE_SCALE[base] };
  }
  return { key: `monster-${base}${monster.rare ? '-rare' : ''}`, tint: null, real: false, scale: 1 };
}
