#!/bin/bash
# Round-trip: push driver scripts to the dev machine, shoot every gallery card there,
# pull PNGs back, crop locally. Set RU_SHOT_HOST to the ssh target that runs the dev
# instance (e.g. export RU_SHOT_HOST=user@devbox.local):
#   bash round.sh <round-name>       -> $SHOTS/<round-name>/*.png
# Requires: ssh + scp to $RU_SHOT_HOST, and python3 + Pillow locally for the size report.
set -e
: "${RU_SHOT_HOST:?export RU_SHOT_HOST=user@devbox (the ssh target running the dev instance)}"
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
R=${1:?round name}
REPO=$(cd "$HERE/../.." && pwd)
SHOTS=${RU_SHOTS_DIR:-$REPO/shots}
DEST=$SHOTS/$R
rm -rf "$DEST"; mkdir -p "$DEST"
for f in ru-shots.sh ru-cdp.mjs; do
  scp -q "$HERE/$f" "$RU_SHOT_HOST:.hermes/cache/ru-shots/$f"
done
ssh -q "$RU_SHOT_HOST" 'cd ~/.hermes/cache/ru-shots; chmod +x ru-shots.sh; rm -f ru-out/*; ./ru-shots.sh all gallery.json 2>&1 | grep -v "^-rw\|^total\|^drwx"'
ssh -q "$RU_SHOT_HOST" 'cd ~/.hermes/cache/ru-shots; COPYFILE_DISABLE=1 tar czf - -C ru-out . | base64' 2>/dev/null | base64 -d | tar xzf - -C "$DEST" 2>/dev/null
python3 -c "from PIL import Image;import sys,glob
for f in sorted(glob.glob(sys.argv[1]+'/*.png')): im=Image.open(f); print(f.split('/')[-1], im.size)" "$DEST"
