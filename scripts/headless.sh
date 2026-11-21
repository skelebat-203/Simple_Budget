#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Run headless Chromium inside the Claude Code sandbox.
# Usage: scripts/headless.sh {screenshot|dom|pdf} {url} [{out-file}]
set -euo pipefail

# --no-sandbox: Chrome's own sandbox can't start inside Claude Code's, which still contains Chrome.
CHROME_FLAGS=(--headless --no-sandbox --disable-gpu)
WINDOW_SIZE="1280,800"

source "$(dirname "${BASH_SOURCE[0]}")/browser-env.sh"

USAGE='usage: headless.sh {screenshot|dom|pdf} {url} [{out-file}]'
mode="${1:?$USAGE}"
url="${2:?missing url}"
out="${3:-}"

case "$mode" in
  screenshot) "$CHROME_PATH" "${CHROME_FLAGS[@]}" --window-size="$WINDOW_SIZE" --screenshot="${out:-screenshot.png}" "$url" ;;
  pdf)        "$CHROME_PATH" "${CHROME_FLAGS[@]}" --print-to-pdf="${out:-page.pdf}" "$url" ;;
  dom)        "$CHROME_PATH" "${CHROME_FLAGS[@]}" --dump-dom "$url" > "${out:-/dev/stdout}" ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
