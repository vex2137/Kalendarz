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
      label={language === 'pl' ? 'Pobierz aplikację' : 'Download app'}
      className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
    >
      <div className="theme-surface theme-border border rounded-2xl p-6 max-w-lg w-full space-y-4">
        <h3 className="font-bold text-lg">
          {language === 'pl'
            ? 'Kalendarz — pliki do pobrania'
            : 'Calendar — downloads'}
        </h3>
        <p className="text-sm theme-muted">
          {language === 'pl'
            ? 'Wersja uruchomionej aplikacji'
            : 'Running app version'}
          : {version}
        </p>
        <p className="text-sm">
          {language === 'pl'
            ? 'Aktualne wydania dla Androida, Windows i Linux oraz rzeczywiste rozmiary plików znajdziesz na stronie wydań. Pobranie wymaga internetu.'
            : 'Find current Android, Windows and Linux releases and actual file sizes on the releases page. Downloading requires internet access.'}
        </p>
        <a
          href="https://github.com/vex2137/Kalendarz/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-blue-600 text-white p-3 text-center"
        >
          {language === 'pl'
            ? 'Otwórz najnowsze wydanie'
            : 'Open latest release'}
        </a>
        <button onClick={onClose} className="theme-input rounded-lg p-2 w-full">
          {t.close}
        </button>
      </div>
    </Dialog>
  );
}
