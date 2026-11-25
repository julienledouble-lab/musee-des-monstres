"""Prepare a monster image for the game.

Usage: python scripts/prepare_sprite.py <source image> <output name, e.g. dragonnet>

- Removes a plain white/light background (flood fill from the borders, so white
  details inside the monster are kept) when the image has no transparency.
- Trims empty margins, fits the monster in a 256 x 256 PNG, feet at the bottom.
- Writes src/assets/sprites/<name>.png; the game picks up every PNG there automatically
  (name = species id, add "-rare" for the rare colour variant).
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

SIZE = 256
MARGIN = 6
BG_TOLERANCE = 38  # how far from the corner colour a pixel may be to count as background


def remove_background(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    alpha = img.getchannel('A')
    if alpha.getextrema()[0] < 250:
        return img  # already has transparency
    w, h = img.size
    px = img.load()
    ref = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    ref = tuple(sum(c[i] for c in ref) // 4 for i in range(3))

    def is_bg(p):
        return sum(abs(p[i] - ref[i]) for i in range(3)) <= BG_TOLERANCE

    mask = Image.new('L', (w, h), 255)
    m = mask.load()
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    seen = set()
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not is_bg(px[x, y]):
            continue
        m[x, y] = 0
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # soften the cut edge a little
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    img.putalpha(mask)
    return img


def fit(img: Image.Image) -> Image.Image:
    bbox = img.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
    img = img.crop(bbox)
    scale = (SIZE - 2 * MARGIN) / max(img.size)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, ((SIZE - img.width) // 2, SIZE - MARGIN - img.height), img)
    return out


def main():
    src, name = sys.argv[1], sys.argv[2]
    out_dir = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'sprites'
    out_dir.mkdir(parents=True, exist_ok=True)
    out = fit(remove_background(Image.open(src)))
    dest = out_dir / f'{name}.png'
    out.save(dest, optimize=True)
    print(f'wrote {dest} ({dest.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
