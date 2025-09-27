#!/usr/bin/env bash
set -euo pipefail

# Ensure 'zip' is available
if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' is not installed. Install it (e.g., 'sudo apt install zip' or 'brew install zip')." >&2
  exit 1
fi

# Pick date command (GNU 'date' or 'gdate' on macOS via coreutils)
DATECMD=date
if command -v gdate >/dev/null 2>&1; then
  DATECMD=gdate
fi

# Folder name and timestamp in Europe/Kyiv
folder_name="$(basename "$PWD")"
timestamp="$(TZ="Europe/Kyiv" "$DATECMD" +'%Y-%m-%d_%H%M%S')"

archive_name="${timestamp}_${folder_name}.zip"
archive_path="$(dirname "$PWD")/${archive_name}"

# Create ZIP in the parent directory, excluding .git everywhere
zip -r -9 "$archive_path" . \
  -x "./.git" "./.git/*" "*/.git/*"

echo "Created: $archive_path"
