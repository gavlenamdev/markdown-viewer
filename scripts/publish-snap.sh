#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="${1:-$ROOT/dist/markdown-viewer_1.0.0_amd64.snap}"
NAME="markdown-viewer"

if [[ ! -f "$SNAP" ]]; then
  echo "Snap not found: $SNAP"
  echo "Build it first with: npm run dist:snap"
  exit 1
fi

if [[ -z "${SNAPCRAFT_STORE_CREDENTIALS:-}" ]]; then
  cat <<'EOF'
Snap Store login is required.

1. Create an Ubuntu One account: https://snapcraft.io/account
2. On a machine with snapcraft installed, run:

     snapcraft export-login snap-creds.txt

3. Publish with:

     export SNAPCRAFT_STORE_CREDENTIALS="$(cat snap-creds.txt)"
     ./scripts/publish-snap.sh
EOF
  exit 1
fi

docker run --rm \
  -e SNAPCRAFT_STORE_CREDENTIALS \
  -v "$(dirname "$SNAP")":/dist \
  -w /dist \
  snapcore/snapcraft:stable \
  bash -lc "snapcraft register '$NAME' || true; snapcraft upload --release=stable '/dist/$(basename "$SNAP")'"
