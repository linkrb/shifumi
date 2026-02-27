#!/usr/bin/env python3
"""
Process fire tower animation sprite sheet (4x2 grid, magenta background).
Extracts 8 frames, removes magenta via flood-fill, aligns by unified bounding box.
"""

from PIL import Image, ImageFilter
import numpy as np
from scipy.ndimage import binary_fill_holes, binary_dilation, label as scipy_label
import os, sys

SRC = "temp/Sprite_sheet_of_animated_tower_9b9c284820.jpeg"
DST_DIR = "public/images/td/towers/fire"
ROWS, COLS = 2, 4
SIDE = 256

img = Image.open(SRC).convert("RGBA")
W, H = img.size
print(f"Image: {W}x{H}")

cw = W // COLS
ch = H // ROWS
print(f"Cell size: {cw}x{ch}")

def remove_magenta_floodfill(rgba, tolerance=80):
    """Remove connected magenta background using flood-fill from all 4 borders."""
    arr = np.array(rgba, dtype=np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    H2, W2 = r.shape

    # Magenta mask: high R, low G, high B
    is_magenta = (r > 150) & (g < 100) & (b > 150)

    # Seed from borders
    seed = np.zeros((H2, W2), dtype=bool)
    seed[0, :] = True
    seed[-1, :] = True
    seed[:, 0] = True
    seed[:, -1] = True
    seed &= is_magenta

    # BFS flood-fill
    from collections import deque
    visited = seed.copy()
    queue = deque(zip(*np.where(seed)))
    dirs = [(-1,0),(1,0),(0,-1),(0,1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in dirs:
            ny, nx = cy+dy, cx+dx
            if 0 <= ny < H2 and 0 <= nx < W2 and not visited[ny, nx] and is_magenta[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    # Dilate to eat fringe
    visited = binary_dilation(visited, iterations=3)

    result = np.array(rgba, dtype=np.uint8)
    result[visited, 3] = 0

    # Gaussian smooth on alpha channel
    pil = Image.fromarray(result)
    alpha = pil.split()[3]
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.8))
    # Threshold back to crisp
    alpha_arr = np.array(alpha)
    alpha_arr = np.where(alpha_arr > 128, 255, 0).astype(np.uint8)
    pil.putalpha(Image.fromarray(alpha_arr))
    return pil

# Extract and clean all 8 frames
frames = []
for row in range(ROWS):
    for col in range(COLS):
        x0 = col * cw
        y0 = row * ch
        cell = img.crop((x0, y0, x0 + cw, y0 + ch))
        cleaned = remove_magenta_floodfill(cell, tolerance=80)
        frames.append(cleaned)
        print(f"Frame {row*COLS+col}: extracted and cleaned")

# Compute global bounding box (union of all alpha masks)
global_x0 = cw
global_y0 = ch
global_x1 = 0
global_y1 = 0

for f in frames:
    arr = np.array(f)
    alpha = arr[..., 3]
    rows_with_content = np.any(alpha > 10, axis=1)
    cols_with_content = np.any(alpha > 10, axis=0)
    if not np.any(rows_with_content):
        continue
    r0, r1 = np.where(rows_with_content)[0][[0, -1]]
    c0, c1 = np.where(cols_with_content)[0][[0, -1]]
    global_y0 = min(global_y0, r0)
    global_y1 = max(global_y1, r1)
    global_x0 = min(global_x0, c0)
    global_x1 = max(global_x1, c1)

# Add a small margin
MARGIN = 4
global_y0 = max(0, global_y0 - MARGIN)
global_y1 = min(ch - 1, global_y1 + MARGIN)
global_x0 = max(0, global_x0 - MARGIN)
global_x1 = min(cw - 1, global_x1 + MARGIN)

content_w = global_x1 - global_x0 + 1
content_h = global_y1 - global_y0 + 1
print(f"Global bbox: ({global_x0},{global_y0}) -> ({global_x1},{global_y1}) = {content_w}x{content_h}")

# Save frames: crop to global bbox, scale to 256x256, bottom-aligned
os.makedirs(DST_DIR, exist_ok=True)
for i, f in enumerate(frames):
    crop = f.crop((global_x0, global_y0, global_x1 + 1, global_y1 + 1))

    # Scale to fit within 256x256, maintain aspect ratio
    scale = min(SIDE / content_w, SIDE / content_h)
    new_w = int(content_w * scale)
    new_h = int(content_h * scale)
    crop = crop.resize((new_w, new_h), Image.LANCZOS)

    # Place bottom-centered on 256x256 canvas
    canvas = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    px = (SIDE - new_w) // 2
    py = SIDE - new_h  # bottom-aligned
    canvas.paste(crop, (px, py))

    out_path = os.path.join(DST_DIR, f"tower_fire_anim_{i}.png")
    canvas.save(out_path)
    print(f"Saved: {out_path}")

print("Done!")
