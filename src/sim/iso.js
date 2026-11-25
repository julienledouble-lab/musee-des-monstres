// Isometric 2:1 projection. Tiles are 64 x 32 px; tileToScreen returns the tile center.
export const TILE_W = 64;
export const TILE_H = 32;

export function tileToScreen(tx, ty) {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

// Returns the tile whose diamond contains the screen point.
export function screenToTile(x, y) {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return { tx: Math.floor((a + b) / 2 + 0.5), ty: Math.floor((b - a) / 2 + 0.5) };
}
