#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Start the preview server and run Lighthouse in ONE command (each sandboxed command has its own
# private network, so a server from an earlier command can't be reached). Build first.
# Usage: scripts/lighthouse.sh {report-path} [{categories}]
# Env: PREVIEW_CMD overrides the server command (must listen on PREVIEW_PORT).
set -euo pipefail

PREVIEW_PORT="4173"
PREVIEW_HOST="127.0.0.1"
PREVIEW_CMD="${PREVIEW_CMD:-npx vite preview --host $PREVIEW_HOST --port $PREVIEW_PORT --strictPort}"
PREVIEW_WAIT_SECONDS="2"
DEFAULT_CATEGORIES="accessibility"

source "$(dirname "${BASH_SOURCE[0]}")/browser-env.sh"

USAGE='usage: lighthouse.sh {report-path} [{categories}]'
report="${1:?$USAGE}"
categories="${2:-$DEFAULT_CATEGORIES}"

$PREVIEW_CMD >/dev/null 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; pkill -f "$PREVIEW_CMD" 2>/dev/null || true' EXIT
sleep "$PREVIEW_WAIT_SECONDS"

npx lighthouse "http://$PREVIEW_HOST:$PREVIEW_PORT/" --quiet --chrome-flags="--no-sandbox" \
  --only-categories="$categories" --output=json --output-path="$report"
