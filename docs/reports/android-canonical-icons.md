# Unify packaged icons using the unchanged Android launcher

Canonical source: android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png.
SHA-256: 87cb2f2ffe992652bb4fa768c73719a37b5852ab17fbf8e170e888f7a42b0761.
This exact PNG is present in the accepted signed Android lifecycle diagnostic APK
(SHA-256 80038012c11b27557821869ea02ac1df91c23df3c3a266a3fe5c4dadca73ce47).
The adaptive launcher references the existing foreground/background resources;
Android assets, manifest, signing and APK are unchanged. Other operating systems
apply their own launcher masks. The existing precomposed launcher PNG is used
without redrawing or changing the artwork; 512px derivatives upscale its 192px
original, rather than inventing detail.

The prior desktop generator used public/icon.svg (a separate calendar “31” design).
PWA PNGs were also independent. The converter now uses the Android resource only,
producing desktop PNG sizes, Windows ICO frames, favicon ICO/PNG, Apple touch and
PWA icons. The compatibility SVG embeds the exact original PNG. The manifest pins
both the unchanged Android reference and every generated file.

Verification covers decoded derivatives, actual AppImage X11 window pixels,
Flatpak installed bundle/menu icon and X11 window pixels, Windows Setup/Portable
and installed EXE resources plus actual HWND icon pixels, and a browser loading
an extracted production Web/PWA ZIP, its favicon and PWA manifest/icons.
Physical pinned shortcuts, Wayland/compositor caches and OS-installed PWA icons
remain manual checks unless explicitly exercised. Windows binaries remain unsigned
with Authenticode, as before; no signing certificate is invented.

Model download/recovery and actual CPU inference were verified at application
commit aa90a317c9e89ae8ef984de6e435df6f4604eb28, private run 42894252025.
A strict scope guard requires application, AI/backend, Android and data code to
remain byte-identical to that baseline. Icon packaging does not repeat model
training or hardware benchmarks. No GGUF is packaged and no public Release or
PR merge is authorized by this correction.
