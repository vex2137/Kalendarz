import React from 'react';
import { X, Download, Monitor, Terminal, FileCode, CheckCircle2, ExternalLink } from 'lucide-react';
import { AppLanguage, getTranslation } from '../utils/i18n';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: AppLanguage;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  language = 'pl',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Pobierz aplikację desktopową
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Wersje instalacyjne i samodzielne dla systemów Windows i Linux
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4">
          {/* GitHub Release Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-emerald-600/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                  v1.1.0
                </span>
                <span className="font-semibold text-xs text-gray-900 dark:text-white">
                  Oficjalne wydanie GitHub Releases
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Pliki .exe oraz .AppImage są już wgrane na Twoje repozytorium GitHub
              </p>
            </div>
            <a
              href="https://github.com/vex2137/Kalendarz/releases/tag/v1.1.0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              <span>Zobacz na GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Windows Section */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#141416]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  Windows (.exe)
                </h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                234.3 MB
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Samodzielny plik wykonywalny dla systemu Windows (x64). Nie wymaga instalacji.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://github.com/vex2137/Kalendarz/releases/download/v1.1.0/Kalendarz-Offline.exe"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                Pobierz Kalendarz-Offline.exe
              </a>
              <a
                href="https://github.com/vex2137/Kalendarz/releases/download/v1.1.0/Kalendarz-Offline-1.0.0-win.zip"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
              >
                Paczka ZIP (193 MB)
              </a>
            </div>
          </div>

          {/* Linux AppImage Section */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#141416]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                  Linux (.AppImage)
                </h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                169.4 MB
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Paczka AppImage dla wszystkich dystrybucji Linuksa (Ubuntu, Debian, Fedora, Arch, CachyOS).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/vex2137/Kalendarz/releases/download/v1.1.0/Kalendarz-Offline-1.0.0.AppImage"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                Pobierz .AppImage
              </a>
              <span className="text-[11px] text-gray-500 font-mono">
                chmod +x Kalendarz-Offline-1.0.0.AppImage
              </span>
            </div>
          </div>

          {/* Linux Flatpak info */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#141416]/50">
            <div className="flex items-center gap-2 mb-1.5">
              <FileCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                Linux Flatpak
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              Plik manifestu <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-800 rounded font-mono text-[11px]">com.vex2137.kalendarz.yml</code> oraz skrypt <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-800 rounded font-mono text-[11px]">./build-flatpak.sh</code> są gotowe w katalogu głównym projektu.
            </p>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 text-xs font-mono">
              ./build-flatpak.sh
            </div>
          </div>

          {/* Local directory path note */}
          <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Lokalizacja plików w projekcie:
            </div>
            <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] opacity-90">
              <li>release/Kalendarz Offline.exe (Windows)</li>
              <li>release/Kalendarz Offline-1.0.0.AppImage (Linux)</li>
              <li>release/Kalendarz Offline-1.0.0-win.zip (Windows ZIP)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
