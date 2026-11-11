#!/bin/sh
# Optional per-user integration; never run automatically or as root.
set -eu
if [ "$#" -ne 1 ]; then echo 'Usage: install-desktop-entry.sh /absolute/path/to/Calendar.AppImage' >&2; exit 2; fi
image=$(realpath "$1")
test -f "$image"
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data=${XDG_DATA_HOME:-"$HOME/.local/share"}
mkdir -p "$data/applications" "$data/icons/hicolor/512x512/apps"
cp "$base/desktop-icon.png" "$data/icons/hicolor/512x512/apps/com.vex2137.kalendarz.png"
# Desktop Exec has its own quoting rules; reject control characters and escape metacharacters.
python3 - "$image" "$data/applications/com.vex2137.kalendarz.desktop" <<'PY'
from pathlib import Path
import sys
p=sys.argv[1]
if any(c in p for c in '\n\r\x00'):raise SystemExit('Invalid path')
p=p.replace('\\','\\\\').replace('"','\\"').replace('`','\\`').replace('$','\\$').replace('%','%%')
Path(sys.argv[2]).write_text('[Desktop Entry]\nType=Application\nName=Calendar\nComment=Offline calendar\nExec="'+p+'" %U\nIcon=com.vex2137.kalendarz\nStartupWMClass=com.vex2137.kalendarz\nCategories=Office;Calendar;\nTerminal=false\n')
PY
chmod +x "$image"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$data/applications" || true

command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$data/icons/hicolor" || true
