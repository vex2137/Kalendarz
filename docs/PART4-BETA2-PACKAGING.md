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

Required jobs: regression validation; signed Android; AppImage + exact payload; actual published 1.4.2 Portable legacy-profile upgrade to Setup, plus Setup/Portable installation/update/profile tests plus CPU inference; actual Flatpak build/install/sandbox/CPU/update tests; final re-download of all five packages with size/SHA-256/source checks. A failed job blocks the five-format completion claim. Tests requiring physical POCO, RTX, Windows taskbar rendering or a host portal are reported separately. The source checkpoint is not itself a statement that these jobs passed.

AppImage menu integration is optional: download `install-desktop-entry.sh` and `desktop-icon.png` from the same private Linux artifact and run `sh ./install-desktop-entry.sh /absolute/path/to/the.AppImage`. It writes only the user's XDG desktop/icon entries and does not touch application data. Moving the AppImage requires rerunning that command.

The published 1.4.2 Windows EXE is a **Portable launcher**, not a Setup installer. The upgrade test must launch that actual EXE, seed its historical profile, and then verify the new Setup reads it. It separately checks repeated Setup installation and uninstall/reinstall retention. The old root Flatpak recipe/launcher is updated to use one canonical manifest (`com.vex2137.kalendarz.yml`, JSON syntax is valid YAML); a missing license source is now supplied as the already-declared MIT license.

Flatpak permission validation follows upstream 1.12.7 `flatpak-context.c:1075–1076`: `fallback-x11` serializes both `fallback-x11` and `x11`. The checker compares exact sets and continues to reject filesystem, all-device and extra bus grants. Locale files remain bundled. Sandbox startup, inference and update tests now precede expensive standalone-bundle compression; the final bundle is still installed and checked afterward, with data retained. Failed attempts preserve private diagnostics.

The packaging-only follow-up reuses the completed full browser/migration job `129203942821` from source `1e8deb2debf9776b5bff1a14a33b11c2bb0f4d41`. A fail-closed Git diff allowlist proves all application/runtime/dependency inputs are byte-identical, and verifies the actual successful job and its retained upgrade snapshots. Unit/policy tests and all actual package/runtime acceptance jobs run again on the final source. Any later application change must restore full browser validation; it cannot pass this narrowly scoped reuse guard.

The Ubuntu 22.04 Flatpak job explicitly selects Python 3.12: its system Python 3.10 lacks `hashlib.file_digest`. The direct CPU acceptance request uses the application's non-thinking Qwen chat-template setting and a bounded 64-token response. The CDP shutdown check tolerates only the expected closed-context result, and still requires the process to exit.
