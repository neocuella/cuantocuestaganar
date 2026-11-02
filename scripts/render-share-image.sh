#!/bin/sh
# Renders scripts/share-image.html to site/og.jpg (1200x630) and scripts/touch-icon.html to
# site/apple-touch-icon.png (180x180) with headless Chrome. The share image is saved as JPEG to
# stay under ~300 KB, past which WhatsApp drops the preview image.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")" && pwd)"
SITE="$DIR/../site"
TMP="$(mktemp -d)"

"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=8000 \
  --screenshot="$TMP/og.png" "file://$DIR/share-image.html"
sips -s format jpeg -s formatOptions 72 "$TMP/og.png" --out "$SITE/og.jpg" >/dev/null

"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=180,180 --virtual-time-budget=2000 \
  --screenshot="$SITE/apple-touch-icon.png" "file://$DIR/touch-icon.html"

rm -r "$TMP"
