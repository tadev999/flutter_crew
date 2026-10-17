#!/usr/bin/env bash

# ==============================================================================
# FlutterCrew Uninstaller Script
# Removes the FlutterCrew fleet and restores project backups.
# ==============================================================================

set -e

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Target directory '$TARGET_DIR' does not exist!"
  echo "👉 Usage: ./uninstall.sh <path_to_flutter_project>"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required."
  exit 1
fi

exec node "$SOURCE_DIR/bin/cli.js" uninstall "$TARGET_DIR"
