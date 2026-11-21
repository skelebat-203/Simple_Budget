# SPDX-License-Identifier: GPL-3.0-only
# Sourced by headless.sh and lighthouse.sh. Sets CHROME_PATH to chrome-headless-shell.
# Looks in this checkout's tools/browsers/, then the main checkout's (for git worktrees).

BROWSER_DIR_NAME="chrome-headless-shell-linux64"
BROWSER_BIN_NAME="chrome-headless-shell"
BROWSER_REL_PATH="tools/browsers/$BROWSER_DIR_NAME/$BROWSER_BIN_NAME"

if [ -z "${CHROME_PATH:-}" ]; then
  this_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  main_root="$(dirname "$(cd "$this_root" && git rev-parse --path-format=absolute --git-common-dir)")"
  for root in "$this_root" "$main_root"; do
    if [ -x "$root/$BROWSER_REL_PATH" ]; then
      CHROME_PATH="$root/$BROWSER_REL_PATH"
      break
    fi
  done
fi

if [ -z "${CHROME_PATH:-}" ] || [ ! -x "$CHROME_PATH" ]; then
  echo "chrome-headless-shell not found. See 'Setup' in lighthouse-sandbox.md." >&2
  exit 1
fi
export CHROME_PATH
