import { tr, type AppLanguage } from '../utils/i18n';
import { useRegisterSW } from 'virtual:pwa-register/react';
export function AppUpdate({ language = 'en' }: { language?: AppLanguage }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div
      className="fixed bottom-20 left-2 right-2 z-50 theme-surface border theme-border p-3 rounded-lg text-sm"
      role="status"
    >
      {tr(language, 'Dostępna aktualizacja. Zapisz otwarte zmiany przed przeładowaniem.', 'Update available. Save open changes before reloading.')}
      <button
        className="ml-2 underline"
        onClick={() => void updateServiceWorker(true)}
      >
        {tr(language, 'Aktualizuj', 'Update')}
      </button>
    </div>
  );
}
