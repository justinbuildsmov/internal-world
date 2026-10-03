#!/usr/bin/env python3
"""Render the link-preview image (site/app/opengraph-image.png, 1200x630):
the voxel Earth from the site's camera angle, drawn in PIL so no browser is needed."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from elevation import ROOT, STOPS, colorize

MODEL = "claude-fable-5-1"          # best terrain (lowest error, best shape match)
S = 2                               # supersample, downscaled at the end
W, H = 1200 * S, 630 * S
BG = (5, 7, 12)

z = np.array([np.nan if v is None else v for v in
              json.load(open(ROOT / "site/public/data" / f"{MODEL}.json"))], float)
rows, cols = 90, 180
z = z.reshape(rows, cols)

def vheight(e):                      # same mapping as lib/world.ts voxelHeight
    return np.where(e <= 0, np.maximum(0.12, 0.6 + e / 16000), 0.6 + e / 650)

h = vheight(np.nan_to_num(z, nan=-4000))
col = colorize(np.nan_to_num(z, nan=-4000))

# Orthographic camera matching the site's starting view.
polar, azim = 0.88, -0.32
cam = np.array([np.sin(polar) * np.sin(azim), np.cos(polar), np.sin(polar) * np.cos(azim)])
right = np.cross([0, 1, 0], cam); right /= np.linalg.norm(right)
up = np.cross(cam, right)
scale = 5.4 * S
ox, oy = W * 0.57, H * 0.60

def proj(p):
    p = np.asarray(p, float)
    return (ox + scale * p @ right, oy - scale * p @ up)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
g = 0.43                              # half footprint (0.86 like the site)
order = sorted(((i, j) for i in range(rows) for j in range(cols)),
               key=lambda ij: (ij[1] - cols / 2) * cam[0] + (ij[0] - rows / 2) * cam[2])
side_x = 1 if cam[0] > 0 else -1      # which vertical side faces the camera
for i, j in order:
    x, zc, top = j - cols / 2 + 0.5, i - rows / 2 + 0.5, h[i, j]
    c = col[i, j]
    T = [proj((x + dx, top, zc + dz)) for dx, dz in ((-g, -g), (g, -g), (g, g), (-g, g))]
    front = [proj((x - g, top, zc + g)), proj((x + g, top, zc + g)),
             proj((x + g, 0, zc + g)), proj((x - g, 0, zc + g))]
    sx = x + side_x * g
    side = [proj((sx, top, zc - g)), proj((sx, top, zc + g)),
            proj((sx, 0, zc + g)), proj((sx, 0, zc - g))]
    d.polygon(side, fill=tuple((c * 0.55).astype(int)))
    d.polygon(front, fill=tuple((c * 0.72).astype(int)))
    d.polygon(T, fill=tuple(np.clip(c * 1.08, 0, 255).astype(int)))

# Fade the top-left so the title sits on clean dark.
fade = Image.new("L", (W, H), 0)
fd = ImageDraw.Draw(fade)
for k in range(260):
    a = int(235 * (1 - k / 260) ** 1.6)
    fd.rectangle([0, 0, W, int(H * 0.08) + k * S], fill=a)
img = Image.composite(Image.new("RGB", (W, H), BG), img, fade)

def font(size, weight):
    f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size * S)
    # axes: Width, Optical Size, GRAD, Weight
    f.set_variation_by_axes([100, min(96, size), 400, weight])
    return f

d = ImageDraw.Draw(img)
title = font(84, 650)
x0, y0 = 64 * S, 52 * S
d.text((x0, y0), "Internal ", font=title, fill=(233, 237, 243))
d.text((x0 + d.textlength("Internal ", font=title), y0), "World", font=title, fill=(242, 196, 109))
d.text((x0 + 3 * S, y0 + 104 * S), "an experiment by @justinbuilds.mov",
       font=font(26, 450), fill=(150, 158, 170))

img.resize((1200, 630), Image.LANCZOS).save(ROOT / "site/app/opengraph-image.png", optimize=True)
print("wrote site/app/opengraph-image.png")
