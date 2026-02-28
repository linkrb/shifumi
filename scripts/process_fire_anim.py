#!/usr/bin/env python3
"""
Process fire tower animation sprite sheet (4x4 grid, magenta background).
Uses rembg for clean AI background removal, unified bbox alignment.
"""

from PIL import Image
import numpy as np
from rembg import remove
import os

SRC = "temp/Gemini_Generated_Image_adl1znadl1znadl1.png"
DST_DIR = "public/images/td/towers/fire"
ROWS, COLS = 4, 4
SIDE = 256

img = Image.open(SRC).convert("RGBA")
W, H = img.size
print(f"Image: {W}x{H}")

# Detect grid lines (dark separator lines between cells)
arr = np.array(img)
r, g, b = arr[...,0].astype(float), arr[...,1].astype(float), arr[...,2].astype(float)

# Grid lines are dark (low RGB) - find columns/rows that are mostly dark
brightness = (r + g + b) / 3
row_dark = (brightness < 60).mean(axis=1)
col_dark = (brightness < 60).mean(axis=0)

def find_content_ranges(dark_mask, total, n):
    """Find n content ranges by excluding dark separator bands."""
    from collections import deque
    # Find dark bands
    bands = []
    in_band = False
    start = 0
    for i, d in enumerate(dark_mask):
        if d > 0.3 and not in_band:
            in_band = True
            start = i
        elif d <= 0.3 and in_band:
            in_band = False
            bands.append((start, i-1))
    if in_band:
        bands.append((start, total-1))

    # Content ranges between bands
    edges = [0]
    for s, e in bands:
        edges.append(s)
        edges.append(e+1)
    edges.append(total)

    content = []
    for i in range(0, len(edges)-1, 2):
        s, e = edges[i], edges[i+1]
        if e - s > total // (n * 3):
            content.append((s, e))

    return content if len(content) == n else None

h_ranges = find_content_ranges(row_dark, H, ROWS)
v_ranges = find_content_ranges(col_dark, W, COLS)

# Fallback: even split
if not h_ranges:
    ch = H // ROWS
    h_ranges = [(r*ch, (r+1)*ch) for r in range(ROWS)]
    print("Fallback: even row split")
if not v_ranges:
    cw = W // COLS
    v_ranges = [(c*cw, (c+1)*cw) for c in range(COLS)]
    print("Fallback: even col split")

print(f"Row ranges: {h_ranges}")
print(f"Col ranges: {v_ranges}")

# Extract cells and remove background with rembg
frames = []
for ri, (y0, y1) in enumerate(h_ranges):
    for ci, (x0, x1) in enumerate(v_ranges):
        cell = img.crop((x0, y0, x1, y1)).convert("RGBA")
        cleaned = remove(cell)
        frames.append(cleaned)
        idx = ri * COLS + ci
        print(f"Frame {idx}: {x1-x0}x{y1-y0} → bg removed")

# Unified bounding box across all frames
gy0, gx0 = 99999, 99999
gy1, gx1 = 0, 0
for f in frames:
    a = np.array(f.split()[3])
    rows_ok = np.any(a > 10, axis=1)
    cols_ok = np.any(a > 10, axis=0)
    if not np.any(rows_ok):
        continue
    r0, r1 = np.where(rows_ok)[0][[0,-1]]
    c0, c1 = np.where(cols_ok)[0][[0,-1]]
    gy0 = min(gy0, r0); gy1 = max(gy1, r1)
    gx0 = min(gx0, c0); gx1 = max(gx1, c1)

MARGIN = 4
fh, fw = frames[0].size[1], frames[0].size[0]
gy0 = max(0, gy0 - MARGIN)
gy1 = min(fh-1, gy1 + MARGIN)
gx0 = max(0, gx0 - MARGIN)
gx1 = min(fw-1, gx1 + MARGIN)

bw = gx1 - gx0 + 1
bh = gy1 - gy0 + 1
print(f"Global bbox: ({gx0},{gy0})->({gx1},{gy1}) = {bw}x{bh}")

# Save bottom-aligned 256x256
os.makedirs(DST_DIR, exist_ok=True)
for i, f in enumerate(frames):
    crop = f.crop((gx0, gy0, gx1+1, gy1+1))
    scale = min(SIDE / bw, SIDE / bh)
    nw, nh = int(bw * scale), int(bh * scale)
    crop = crop.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIDE, SIDE), (0,0,0,0))
    canvas.paste(crop, ((SIDE-nw)//2, SIDE-nh))
    out = os.path.join(DST_DIR, f"tower_fire_anim_{i}.png")
    canvas.save(out)
    print(f"Saved: {out}")

print("Done!")
