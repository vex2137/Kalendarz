# Part 4 Beta 2 packaging checkpoint

This extends the accepted Part 4 Beta 1 commit `b4293cbfcdd472d6520f84fe8abc401575493f0f`. It does not change calendar/AI data formats or inference backends. No public release or merge is authorized.

## Identities, icons and data

The official `public/icon.svg` is the source of checked-in PNG/ICO derivatives. The old `pwa-512x512.png` is a plain blue placeholder; desktop packaging and BrowserWindow now use the rendered calendar icon. `packaging/icons/manifest.json` binds every derivative to the source SVG; unit tests check its hashes and DPI sizes. Optional regeneration uses Playwright Chromium and developer-installed Pillow, with no new application dependency.

Desktop product name remains **Calendar**, application ID `com.vex2137.kalendarz`, desktop filename `com.vex2137.kalendarz.desktop`. Windows uses that AppUserModelID; Linux sets matching WM_CLASS/Wayland app ID. Real taskbar/dock appearance still requires the target desktop environment, not merely an icon resource check.

Installed Windows and AppImage retain their historical `Kalendarz Offline` application-data directory. The per-user NSIS installer does not request elevation and retains application data on uninstall. No Windows Authenticode certificate is configured: Setup and Portable are explicitly **unsigned**, with resource/icon editing retained. Do not confuse this with Android signing.

The single-file Portable launcher uses electron-builder's `PORTABLE_EXECUTABLE_DIR` and stores Chromium, IndexedDB, history, managed models and settings in **Calendar Data** beside the outer EXE. Move the EXE and that directory together. Explicit `--user-data-dir` remains an intentional override. A non-writable Portable directory stops with an error; it never silently switches to the installed profile. External model-folder paths remain references to their original locations; reselect them if moved or on another computer. Loading from a read-only directory is unsupported.

## Flatpak sandbox

The real bundle uses Freedesktop 25.08 and Electron2.BaseApp 25.08 (Zypak), not an AppImage run with `--no-sandbox`. It reuses the exact verified `linux-unpacked` payload, including CPU/CUDA/Vulkan libraries and their licenses. No GGUF is packaged.

Permissions: Wayland/fallback X11, shared IPC, DRI for existing GPU support, desktop notifications, and network for user-selected downloads/updates and the local inference server. There is **no home/host/filesystem grant**. `ELECTRON_USE_PORTAL=1` requests the native document/file chooser; selecting external models requires a working host document portal. No broad filesystem override is added automatically. NVIDIA acceleration additionally depends on matching host Flatpak GL/NVIDIA driver extensions; packaging or discovery does not prove GPU offload.

Data persists in `~/.var/app/com.vex2137.kalendarz/` under Flatpak's XDG directories. It is deliberately isolated from AppImage/installed profiles. Use the existing JSON/QR export/import to transfer data; the package never resets or automatically copies another profile. `flatpak uninstall` must be used without `--delete-data` to retain that profile.

The downloadable `.flatpak` embeds the app and references the public Flathub runtime repository; it is not published to Flathub. Installation may download platform runtimes. The app artifact itself remains private.

## Private workflow and evidence

`scripts/part4-beta2-private-build.yml` is installed only as `.github/workflows/build-part4-beta2.yml` in `vex2137/Kalendarz-private-builds`. Every job checks a full source SHA, current branch HEAD, accepted Beta 1 ancestry, clean checkout and build-info. No shared signing key is committed or uploaded as an artifact. Existing one-use encrypted signing transport is allowlisted only for this audited private workflow. Android requires the original `ae055d7e…564143` certificate, package `com.kalendarz.offline.diagnostics`, code **10523**, version `1.5.0-part4-beta.2`.

Required jobs: regression validation; signed Android; AppImage + exact payload; actual Windows Setup/Portable installation/update/profile tests plus CPU inference; actual Flatpak build/install/sandbox/CPU/update tests; final re-download of all five packages with size/SHA-256/source checks. A failed job blocks the five-format completion claim. Tests requiring physical POCO, RTX, Windows taskbar rendering or a host portal are reported separately. The source checkpoint is not itself a statement that these jobs passed.

AppImage menu integration is optional: download `install-desktop-entry.sh` and `desktop-icon.png` from the same private Linux artifact and run `sh ./install-desktop-entry.sh /absolute/path/to/the.AppImage`. It writes only the user's XDG desktop/icon entries and does not touch application data. Moving the AppImage requires rerunning that command.
