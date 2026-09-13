import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  // If already installed into standalone mobile app, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android beforeinstallprompt is ready
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install-direct"
        type="button"
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors ${
          compact ? 'text-xs' : ''
        }`}
        title="Zainstaluj jako aplikację na telefonie"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Zainstaluj aplikację</span>
      </button>
    );
  }

  // Fallback button with guided instructions if beforeinstallprompt is not triggered yet or iOS
  return (
    <>
      <button
        id="btn-pwa-install-guide"
        type="button"
        onClick={() => {
          if (isIOS) setShowIOSGuide(true);
          else setShowAndroidGuide(true);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium border border-stone-200 transition-colors"
        title="Instrukcja instalacji na telefonie"
      >
        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
        <span className="hidden sm:inline">Zainstaluj na telefonie</span>
        <span className="sm:hidden">Zainstaluj</span>
      </button>

      {/* Guide modal for iOS */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Instalacja na iPhone / iPad</h3>
              <button onClick={() => setShowIOSGuide(false)} className="p-1 rounded-lg text-stone-500 hover:bg-stone-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-stone-700 leading-relaxed">
              <p>1. W przeglądarce Safari kliknij ikonę <strong>Udostępnij</strong> (kwadrat ze strzałką w górę).</p>
              <p>2. Przewiń listę w dół i wybierz <strong>Do ekranu początkowego</strong>.</p>
              <p>3. Kliknij <strong>Dodaj</strong>. Aplikacja zainstaluje się na pulpicie i będzie działać offline.</p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Rozumiem
            </button>
          </div>
        </div>
      )}

      {/* Guide modal for Android */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Instalacja na telefonie Android</h3>
              <button onClick={() => setShowAndroidGuide(false)} className="p-1 rounded-lg text-stone-500 hover:bg-stone-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-stone-700 leading-relaxed">
              <p>1. W prawym górnym rogu przeglądarki Chrome na telefonie dotknij <strong>menu (3 kropki)</strong>.</p>
              <p>2. Dotknij <strong>„Zainstaluj aplikację”</strong> lub <strong>„Dodaj do ekranu głównego”</strong>.</p>
              <p>3. Aplikacja zainstaluje się na telefonie dokładnie tak jak plik APK – z własną ikoną i pełnym ekranem!</p>
            </div>
            <button
              onClick={() => setShowAndroidGuide(false)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </>
  );
};
