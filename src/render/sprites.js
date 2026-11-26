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

export function preloadSprites(scene) {
  for (const [name, url] of Object.entries(SPRITE_URLS)) scene.load.image(`real-${name}`, url);
  for (const [name, url] of Object.entries(DECOR_URLS)) scene.load.image(`img-${name}`, url);
}

// The realistic version of a procedural texture key if one was loaded, else the key itself.
// Buildings are looked up as "bld-<type>".
export function realKey(scene, key) {
  if (scene.textures.exists(`img-${key}`)) return `img-${key}`;
  if (scene.textures.exists(`img-bld-${key}`)) return `img-bld-${key}`;
  return key;
}

// Which texture to draw a monster with: { key, tint, real, scale }.
export function resolveMonsterTexture(scene, monster) {
  const base = monster.speciesId;
  const has = (k) => scene.textures.exists(`real-${k}`);
  if (monster.rare && has(`${base}-rare`)) return { key: `real-${base}-rare`, tint: null, real: true, scale: SPRITE_SCALE[base] };
  if (has(base)) {
    return { key: `real-${base}`, tint: monster.rare ? RARE_FALLBACK_TINT : null, real: true, scale: SPRITE_SCALE[base] };
  }
  return { key: `monster-${base}${monster.rare ? '-rare' : ''}`, tint: null, real: false, scale: 1 };
}
