# AppImage icon versus KDE Plasma task-panel icon

Application artifact: ba9f8e51489b1d3b786aae04953554a7bbfe21f5, SHA-256
936c20ae17b633251581114ada2eb81faff0848d1ded3db9f684d0fc4bba27bf.
This correction does not rebuild it or alter application code, APK, artwork or data.

The AppImage has com.vex2137.kalendarz.desktop, StartupWMClass=com.vex2137.kalendarz,
and Icon=calendar resolving to its own calendar.png. The packaged PNG is the
Android-adaptive master, SHA-256
59ce3165caa8fbcefd5d2c840976441081ef06c89db54c8cd1901a970e7388dc.
Electron sets the desktop name, X11 class and Wayland app ID to the same application
identity. A pinned Plasma task can still use a different, previously installed
.desktop service and its icon instead of the icon shown in the window title.
Replacing an AppImage file does not update those separate per-user files or pins.

## Standalone local repair

Run the updated packaging/linux/install-desktop-entry.sh with desktop-icon.png
beside it and the absolute path to the existing AppImage. It:
- Keeps the canonical desktop ID and StartupWMClass.
- Writes Icon as an absolute, content-addressed PNG path, avoiding old theme-name
  collisions and cached pixmaps with a reused filename.
- Refreshes the unversioned hicolor icon too for existing theme-name references.
- Updates Exec, removes stale TryExec and disables inapplicable DBus activation.
- Preserves localized names, custom actions and other existing fields.
- Backs up a changed desktop entry as .desktop.bak-TIMESTAMP (not a second menu
  entry), uses atomic writes, and is idempotent.
- Does not edit Plasma's pin list or any Calendar profile/model/history files.

On CachyOS/Plasma, close Calendar normally, run the helper and then:

```fish
kbuildsycoca6 --noincremental
```

Unpin only the old Calendar task, launch the repaired Calendar menu entry, and
pin its running task again. Do not open the old pinned shortcut to perform this
step; it may still reference an appimagekit/older desktop ID. No full cache reset,
Plasma configuration deletion or application rebuild is required.

## Read-only diagnosis if a stale icon remains

```fish
rg -n '^(Name|Exec|Icon|StartupWMClass|TryExec|DBusActivatable)=' "$HOME/.local/share/applications/com.vex2137.kalendarz.desktop"
rg -n '^launchers=' "$HOME/.config/plasma-org.kde.plasma.desktop-appletsrc"
gdbus call --session --dest org.kde.KWin --object-path /KWin --method org.kde.KWin.queryWindowInfo
```

The last command asks the user to select a window and reads KWin's actual window
identity on Wayland as well as X11. The Calendar pin should ultimately resolve to
applications:com.vex2137.kalendarz.desktop rather than an obsolete desktop ID.

## Validation status

Four standalone integration tests PASS: stale entry replacement and backup,
idempotence/data-and-pin preservation, preservation of translations/custom actions,
and safe failure with a missing icon. A real Plasma 6 task-panel fixture is being
verified on a disposable runner with nested KWin Wayland; its result and screenshots
must be checked before claiming panel verification. The user's actual CachyOS
configuration and its specific pinned desktop ID remain NOT TESTED remotely.
