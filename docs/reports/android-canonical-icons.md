# Android 16 adaptive artwork on desktop and Web/PWA

The previous 245c1cd packages copied the legacy Android launcher PNG. That was
not an exact reference for Android 16: modern Android composes the original
adaptive foreground and background, expands the layers by 25% on all sides,
and clips them to the launcher's configured mask. Copying the legacy PNG kept
its old frame, margins and smaller sign.

The corrected static artwork uses only:
- android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
  (SHA-256 bd24fd383253bf8d43f0a81f11c071d76d1d555114376dd647cd9fb38fa0a9da).
- The unchanged #FFFFFF from values/ic_launcher_background.xml.
- The exact Android 16 AOSP android-16.0.0_r1 config_icon_mask path and
  AdaptiveIconDrawable child viewport transform, pinned with source URLs in
  packaging/icons/android16-adaptive.json.

No sign is redrawn, recolored, stretched nonuniformly, outlined or shadowed.
The static 512px master is composed from the existing 432px foreground at 1.5x
child bounds, centered at -25% offsets. CairoSVG rasterizes the original cubic
mask path with supersampling; Pillow converts sizes/ICO encoding. These are
developer-only tools. Android resources, manifests, signing and APK are unchanged.

This is the Android 16 AOSP default mask, not a claim to have observed the user's
physical POCO/HyperOS launcher. Manufacturer masks, icon packs, dynamic icon
animations and themed monochrome modes can differ. Exact physical launcher
appearance remains NOT TESTED without a device screenshot.

The compatibility SVG embeds the original adaptive foreground and exact mask;
it is also an independent browser composition reference for PNG comparisons.
PWA any-purpose icons use the static mask. A separate full-bleed maskable PNG
keeps the same centered sign and background, allowing a platform to apply its
own mask exactly once instead of masking a premasked image again.

Private packaging validates exact source hashes, fixed Android 16 mask/viewport,
glyph extent, transparent corners, full-bleed PWA behavior and independent SVG/PNG
browser rendering. It captures real AppImage and installed Flatpak X11 windows,
real Windows Setup/Portable HWND icons/windows, and HTTP-served production PWA
icons. Evidence ZIPs include original Android resources and composition metadata.
Fresh profiles avoid conflating these tests with the user's existing icon cache.

Flatpak is assembled on a fresh runner from the exact same-run AppImage bytes,
with source/provenance/hash checks, then installed and launched in its sandbox.
A bundle reinstall on the isolated GitHub-hosted test runner preserves and hashes
all profile files; it never uses --delete-data. No user installation is removed.

Existing model/AI/calendar/data code remains byte-identical to aa90a317. Its real
Qwen acceptance evidence (private run 42894252025) remains applicable; icon changes
do not repeat GPU benchmarks. No GGUF or signing secret is packaged. Windows
Authenticode remains unsigned. No public Release, merge or Android build occurs.

For stale Linux menus, use the supplied per-user AppImage integration helper
with the new AppImage. It refreshes only the desktop entry and icon cache. KDE
users can additionally run `kbuildsycoca6 --noincremental`, then re-pin a shortcut
that points at an older executable. Windows users should launch the new EXE,
unpin the old taskbar shortcut and pin the new running application. Cache on the
user's actual machines and Wayland-specific dock behavior remain manual checks.
