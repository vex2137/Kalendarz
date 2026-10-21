import { tr } from '../utils/i18n';
import React from 'react';
import { Dialog } from './Dialog';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { version } from '../../package.json';
export function DownloadModal({
  onClose,
  language = 'pl',
}: {
  isOpen: boolean;
  onClose: () => void;
  language?: AppLanguage;
}) {
  const t = getTranslation(language);
  return (
    <Dialog
      onClose={onClose}
      label={tr(language, 'Pobierz aplikację', 'Download app')}
      className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
    >
      <div className="theme-surface theme-border border rounded-2xl p-6 max-w-lg w-full space-y-4">
        <h3 className="font-bold text-lg">
          {tr(language, 'Kalendarz — pliki do pobrania', 'Calendar — downloads')}
        </h3>
        <p className="text-sm theme-muted">
          {tr(language, 'Wersja uruchomionej aplikacji', 'Running app version')}
          : {version}
        </p>
        <p className="text-sm">
          {tr(language, 'Aktualne wydania dla Androida, Windows i Linux oraz rzeczywiste rozmiary plików znajdziesz na stronie wydań. Pobranie wymaga internetu.', 'Find current Android, Windows and Linux releases and actual file sizes on the releases page. Downloading requires internet access.')}
        </p>
        <a
          href="https://github.com/vex2137/Kalendarz/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg theme-primary bg-blue-600 text-white p-3 text-center"
        >
          {tr(language, 'Otwórz najnowsze wydanie', 'Open latest release')}
        </a>
        <button onClick={onClose} className="theme-input rounded-lg p-2 w-full">
          {t.close}
        </button>
      </div>
    </Dialog>
  );
}
