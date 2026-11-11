#!/bin/sh
# Optional per-user integration; never run automatically or as root.
set -eu
if [ "$#" -ne 1 ]; then echo 'Usage: install-desktop-entry.sh /absolute/path/to/Calendar.AppImage' >&2; exit 2; fi
image=$(realpath "$1")
test -f "$image"
chmod +x "$image"
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data=${XDG_DATA_HOME:-"$HOME/.local/share"}
python3 - "$image" "$base/desktop-icon.png" "$data" <<'PY'
from pathlib import Path
import sys,os,hashlib,configparser,tempfile,time,shutil,json
image,source,data=Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]).expanduser().resolve()
if any(c in str(image)+str(data) for c in '\n\r\x00'):raise SystemExit('Invalid path')
png=source.read_bytes()
if not png.startswith(b'\x89PNG\r\n\x1a\n'):raise SystemExit('Integration requires the original desktop-icon.png from the same bundle')
app_id='com.vex2137.kalendarz';sha=hashlib.sha256(png).hexdigest()
icons=data/'icons/hicolor/512x512/apps';applications=data/'applications';icons.mkdir(parents=True,exist_ok=True);applications.mkdir(parents=True,exist_ok=True)
# A content-addressed absolute Icon bypasses theme-name collisions and old KDE pixmaps.
icon=icons/(app_id+'-'+sha+'.png');desktop=applications/(app_id+'.desktop')
def atomic_write(path,content):
 with tempfile.NamedTemporaryFile(dir=path.parent,prefix='.'+path.name+'-',delete=False) as f:
  tmp=Path(f.name)
  try:f.write(content);f.flush();os.fsync(f.fileno())
  except BaseException:tmp.unlink(missing_ok=True);raise
 try:os.chmod(tmp,0o644);os.replace(tmp,path)
 finally:tmp.unlink(missing_ok=True)
for path in [icon,icons/(app_id+'.png')]:
 if not path.exists() or path.read_bytes()!=png:atomic_write(path,png)
config=configparser.ConfigParser(interpolation=None,strict=False);config.optionxform=str
if desktop.exists():
 with desktop.open() as f:config.read_file(f)
if 'Desktop Entry' not in config:config['Desktop Entry']={}
entry=config['Desktop Entry'];entry.setdefault('Name','Calendar');entry.setdefault('Comment','Offline calendar');entry.setdefault('Categories','Office;Calendar;')
escaped=str(image).replace('\\','\\\\').replace('"','\\"').replace('`','\\`').replace('$','\\$').replace('%','%%')
entry.update(Type='Application',Exec='"'+escaped+'" %U',Icon=str(icon).replace('\\','\\\\'),StartupWMClass=app_id,Terminal='false',DBusActivatable='false')
# A stale TryExec can hide the repaired entry; Exec already points to the checked file.
entry.pop('TryExec',None)
from io import StringIO
out=StringIO();config.write(out,space_around_delimiters=False);content=out.getvalue().encode()
backup=None
if desktop.exists() and desktop.read_bytes()!=content:
 backup=desktop.with_name(desktop.name+'.bak-'+str(time.time_ns()));shutil.copy2(desktop,backup)
if not desktop.exists() or desktop.read_bytes()!=content:atomic_write(desktop,content)
print(json.dumps(dict(desktop=str(desktop),icon=str(icon),iconSha256=sha,launcher='applications:'+app_id+'.desktop',backup=str(backup) if backup else None)))
PY
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$data/applications" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$data/icons/hicolor" || true
printf '%s\n' 'On KDE: run kbuildsycoca6 --noincremental; unpin the old Calendar shortcut, launch the new menu entry and pin its running icon. Other pinned apps are not changed.'
