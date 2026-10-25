# Changelog

## 1.4.1 — Latest Stable

- Fix Android GGUF download/import regressions and distinguish successful import from engine compatibility.
- Preserve native CPU inference, experimental GPU backends, explicit processing modes and safe Auto fallback.
- Support external GGUF directories on desktop, diagnostic JSON export and confirmed memory release.
- Preserve existing calendars, settings, assistant history and models on compatible updates.
- Ship model-free Android ARM64, Linux x86_64, Windows x86_64 and production Web packages.
- Publish the original verified packages through a draft-first GitHub Actions workflow; no rebuild or Android private key is needed.
- Retain original Git history and add English-first documentation with a Polish version.

Android GPU inference remains unconfirmed on POCO Mali-G720. Linux includes CPU/Vulkan without bundled CUDA. Windows physical execution and physical NVIDIA/AMD/Intel compatibility are not certified. Further GPU work is deferred to 1.4.2; fine-tuning is not part of this release.

[Full release notes](.github/release-notes/v1.4.1.md) · [Known limitations](docs/known-limitations-1.4.1.md)

### Polski

Naprawiono import i pobieranie GGUF na Androidzie, diagnostykę i obsługę trybów obliczeń. Zachowano dane, modele i historię, dodano obsługę zewnętrznych katalogów GGUF na desktopie. Wydanie obejmuje cztery platformy i oryginalne, zweryfikowane paczki bez ponownej kompilacji. Vulkan pozostaje eksperymentalny; dalsze prace należą do 1.4.2.

Earlier releases remain documented in the repository's Git history and GitHub Releases.
