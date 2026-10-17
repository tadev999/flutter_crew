#!/usr/bin/env bash

# ==============================================================================
# FlutterCrew Installer Script
# Installs the specialized Flutter & Dart AI Coding Fleet into a target project.
# ==============================================================================

set -e

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "❌ Target directory '$TARGET_DIR' does not exist!"
  echo "👉 Usage: ./install.sh <path_to_flutter_project>"
  exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo "Installing FlutterCrew into: $TARGET_DIR..."

# Keep one implementation so both installers ship the same adapters/runtime and
# back up changed files consistently. Existing settings are backed up, not merged.
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required."
  exit 1
fi
exec node "$SOURCE_DIR/bin/cli.js" "$TARGET_DIR"
