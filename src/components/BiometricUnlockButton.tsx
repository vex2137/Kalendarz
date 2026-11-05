import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CalendarDevice } from '../utils/nativeDevice';
import { tr, type AppLanguage } from '../utils/i18n';

export function BiometricUnlockButton({enabled, disabled, language, onUnlock}: {
  enabled: boolean; disabled: boolean; language: AppLanguage; onUnlock: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!enabled || Capacitor.getPlatform() !== 'android') return null;
  const authenticate = async () => {
    if (pending || disabled) return;
    setPending(true); setError(false);
    try {
      const result = await CalendarDevice.authenticateBiometric({title: tr(language, 'Odblokuj Kalendarz', 'Unlock Calendar'), cancel: tr(language, 'Anuluj', 'Cancel')});
      if (result.authenticated === true) onUnlock(); else setError(true);
    } catch { setError(true); } finally { setPending(false); }
  };
  return <div className="w-full text-center space-y-2">
    <button type="button" disabled={pending || disabled} onClick={() => void authenticate()} className="w-full rounded-xl theme-subtle theme-text border theme-border py-2">{tr(language, 'Użyj biometrii', 'Use biometrics')}</button>
    {error && <p role="alert" className="text-xs text-rose-400">{tr(language, 'Biometria niedostępna lub anulowana. Użyj PIN-u albo hasła.', 'Biometrics unavailable or cancelled. Use your PIN or password.')}</p>}
  </div>;
}
