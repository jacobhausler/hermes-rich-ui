#!/usr/bin/env python3
"""Crop full-viewport shots to their card rect using the sidecar written by ru-cdp.mjs.

  python3 crop.py <dir>     # every <name>.png with a <name>.png.json sidecar -> <name>.png (cropped), full kept as <name>.full.png
Prints one line per file: name, crop box (px), final size.
"""
import json
import sys
from pathlib import Path

from PIL import Image

PAD = 8  # CSS px of breathing room around the card


def main(d):
    d = Path(d)
    for side in sorted(d.glob("*.png.json")):
        png = d / side.name[:-5]
        meta = json.loads(side.read_text())
        x, y, w, h = meta["card"]
        im = Image.open(png)
        full = d / (png.stem + ".full.png")
        if not full.exists():
            im.save(full)
        im = Image.open(full)
        # true scale = rendered pixels per CSS px (page zoom != devicePixelRatio under emulation)
        dpr = im.width / meta["vw"]
        box = (max(0, int((x - PAD) * dpr)), max(0, int((y - PAD) * dpr)),
               min(im.width, int((x + w + PAD) * dpr)), min(im.height, int((y + h + PAD) * dpr)))
        out = im.crop(box)
        out.save(png)
        print(f"{png.name}: full={im.width}x{im.height} dpr={dpr} card_css={[round(v) for v in (x, y, w, h)]} box={box} -> {out.width}x{out.height}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
