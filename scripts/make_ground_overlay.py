"""Generate the map-wide ground variation layer (soft darker / drier patches).

Usage: python scripts/make_ground_overlay.py
Writes src/assets/overlay/ground-variation.png. The game stretches it over the whole
isometric ground (playable grid + scenery ring) so the lawn never looks uniform or tiled.
"""
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

W, H = 1024, 512  # 2:1, the shape of the isometric map on screen
random.seed(7)


def octave(cells_x, blur):
    small = Image.new('L', (cells_x, cells_x // 2))
    small.putdata([random.randint(0, 255) for _ in range(small.width * small.height)])
    return small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))


# smooth fractal noise: big shapes + medium + small
noise = ImageChops.add(ImageChops.multiply(octave(8, 18), Image.new('L', (W, H), 150)),
                       ImageChops.multiply(octave(20, 8), Image.new('L', (W, H), 80)), scale=1.0)
noise = ImageChops.add(noise, ImageChops.multiply(octave(48, 3), Image.new('L', (W, H), 40)))
dry = octave(12, 14)

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def over(dst, color, a):
    """Alpha-composite one RGBA colour onto an (r, g, b, a) float tuple."""
    r, g, b, da = dst
    oa = a + da * (1 - a)
    if oa == 0:
        return (0, 0, 0, 0)
    mix = lambda c, d: (c * a + d * da * (1 - a)) / oa
    return (mix(color[0], r), mix(color[1], g), mix(color[2], b), oa)


out = Image.new('RGBA', (W, H))
px, npx, dpx = out.load(), noise.load(), dry.load()
for y in range(H):
    for x in range(W):
        # keep only the isometric diamond, fading out near its edge
        edge = abs(x - W / 2) / (W / 2) + abs(y - H / 2) / (H / 2)
        if edge > 1:
            continue
        n = npx[x, y] / 255  # ~0..1
        d = dpx[x, y] / 255
        c = (0, 0, 0, 0)
        c = over(c, (10, 30, 5), 0.38 * smooth((0.48 - n) / 0.25))      # darker, lusher patches
        c = over(c, (210, 230, 150), 0.18 * smooth((n - 0.58) / 0.25))  # sunlit, lighter patches
        c = over(c, (150, 125, 60), 0.28 * smooth((d - 0.55) / 0.3))    # dry, yellowed patches
        fade = smooth((1 - edge) / 0.04)
        px[x, y] = (int(c[0]), int(c[1]), int(c[2]), int(255 * c[3] * fade))

dest = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'overlay' / 'ground-variation.png'
dest.parent.mkdir(parents=True, exist_ok=True)
out.save(dest, optimize=True)
print('wrote', dest)
