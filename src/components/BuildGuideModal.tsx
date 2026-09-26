import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Terminal, 
  Copy, 
  Check, 
  Laptop, 
  Layers, 
  Monitor, 
  Sparkles,
  ArrowRight,
  FolderOpen,
  CheckCircle2
} from 'lucide-react';

interface BuildGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuildGuideModal: React.FC<BuildGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'apk' | 'linux' | 'windows'>('apk');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="modal-build-guide"
        className="theme-surface theme-text rounded-3xl max-w-2xl w-full shadow-2xl theme-border border overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 theme-border border-b flex items-center justify-between theme-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold theme-text">
                Budowanie aplikacji (APK, Linux, Windows)
              </h3>
              <p className="text-xs theme-muted">
                Wszystkie pliki wykonywalne i natywne wersje w jednym miejscu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex theme-border border-b theme-subtle text-xs font-semibold px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('apk')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'apk'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Android (Plik APK)
          </button>
          <button
            onClick={() => setActiveTab('linux')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'linux'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Linux (CachyOS / Arch / Ubuntu)
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'windows'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Windows (.exe)
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
          {/* TAB 1: APK */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20 text-blue-400 space-y-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Automatyczny skrypt szybkiego budowania APK
                </p>
                <p className="text-blue-300">
                  W projekcie przygotowałem skrypt <code>build-apk.sh</code>. Jedno polecenie kompiluje aplikację, synchronizuje Gradle i automatycznie kopiuje gotowy plik <strong>Kalendarz.apk</strong> do Twojego folderu <code>~/Pobrane</code>!
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  1. Opcja najszybsza — 1 komenda w terminalu:
                </span>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
                    npm run build:apk
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run build:apk', 'cmd-apk')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-apk' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-apk' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  2. Pełny ciąg komend z pobraniem aktualizacji (Git):
                </span>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
{`cd ~/Pobrane/Kalendarz-main
git pull
bash build-apk.sh`}
                  </pre>
                  <button
                    onClick={() => copyToClipboard('cd ~/Pobrane/Kalendarz-main\ngit pull\nbash build-apk.sh', 'cmd-apk-full')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-apk-full' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-apk-full' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
              </div>

              <div className="p-3 theme-subtle rounded-2xl theme-border border space-y-1">
                <p className="font-semibold theme-text">Gdzie znajdziesz gotowy plik APK?</p>
                <p className="theme-muted">
                  Skrypt automatycznie umieści plik w dwóch miejscach:
                  <br />• <code>~/Pobrane/Kalendarz.apk</code>
                  <br />• <code>./Kalendarz-Offline.apk</code> (w głównym folderze projektu)
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: LINUX */}
          {activeTab === 'linux' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 text-emerald-400 space-y-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  Natywna aplikacja na Linux (CachyOS / Arch / Ubuntu)
                </p>
                <p className="text-emerald-300">
                  Skonfigurowałem silnik <strong>Electron</strong>, dzięki czemu możesz używać kalendarza jako zwykłego programu okienkowego na pulpicie (z osobną ikoną, skrótami klawiszowymi i bez paska przeglądarki).
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  Sposób 1: Uruchomienie programu od razu w oknie:
                </span>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
                    npm run desktop
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run desktop', 'cmd-linux-run')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-linux-run' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-linux-run' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  Sposób 2: Zbudowanie samodzielnego pliku .AppImage:
                </span>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
                    npm run dist:linux
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run dist:linux', 'cmd-linux-appimage')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-linux-appimage' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-linux-appimage' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
                <p className="theme-muted text-[11px]">
                  Wygenerowany plik <code>Kalendarz Offline.AppImage</code> znajdzie się w katalogu <code>release/</code>. Możesz go uruchomić na dowolnej dystrybucji Linuksa!
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: WINDOWS */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="bg-indigo-500/10 p-3.5 rounded-2xl border border-indigo-500/20 text-indigo-400 space-y-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-indigo-400" />
                  Aplikacja na Windows 10 / 11
                </p>
                <p className="text-indigo-300">
                  Dodałem skrypt <code>build-windows.bat</code> oraz konfigurację budowania instalatora <code>.exe</code>.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  Sposób 1: Uruchomienie programu dwuklikiem w plik .bat:
                </span>
                <p className="theme-muted">
                  W folderze projektu kliknij dwukrotnie w plik <strong><code>build-windows.bat</code></strong> lub wpisz w terminalu PowerShell / CMD:
                </p>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
                    npm run desktop
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run desktop', 'cmd-win-run')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-win-run' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-win-run' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold theme-text block">
                  Sposób 2: Zbudowanie instalatora .exe:
                </span>
                <div className="relative">
                  <pre className="p-3.5 rounded-2xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-stone-800">
                    npm run dist:win
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run dist:win', 'cmd-win-dist')}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'cmd-win-dist' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'cmd-win-dist' ? 'Skopiowano!' : 'Kopiuj'}
                  </button>
                </div>
                <p className="theme-muted text-[11px]">
                  Instalator <code>Kalendarz Offline Setup.exe</code> zostanie utworzony w katalogu <code>release\</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 theme-subtle theme-border border-t flex items-center justify-between">
          <span className="text-[11px] theme-muted">
            100% Offline • Zero serwerów • Pełna kontrola nad kodem
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
