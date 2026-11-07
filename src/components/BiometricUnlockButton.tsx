import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CalendarDevice } from '../utils/nativeDevice';
import { tr, type AppLanguage } from '../utils/i18n';

export function BiometricUnlockButton({enabled, disabled, language, onUnlock}: {
  enabled: boolean; disabled: boolean; language: AppLanguage; onUnlock: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(false);
  const attempted = useRef(false);
  const inFlight = useRef(false);
  const readinessGeneration = useRef(0);
  const current = useRef({enabled, disabled, language, onUnlock});
  current.current = {enabled, disabled, language, onUnlock};
  const android = Capacitor.getPlatform() === 'android';

  const authenticate = useCallback(async (automatic: boolean) => {
    if (!active.current || !current.current.enabled || current.current.disabled ||
        document.hidden || inFlight.current || (automatic && attempted.current)) return;
    // The ref also excludes duplicate clicks/readiness events before React renders.
    inFlight.current = true;
    const generation = readinessGeneration.current;
    try {
      const status = await CalendarDevice.biometricStatus();
      if (!active.current || current.current.disabled || document.hidden) return;
      // A background/resuming Activity must not consume the single automatic attempt.
      if (!status.ready) return;
      if (automatic && attempted.current) return;
      attempted.current = true;
      setPending(true); setError(false);
      if (!status.available) { setError(true); return; }
      const result = await CalendarDevice.authenticateBiometric({
        title: tr(current.current.language, 'Odblokuj Kalendarz', 'Unlock Calendar'),
        cancel: tr(current.current.language, 'Anuluj', 'Cancel'),
      });
      if (!active.current) return;
      if (result.authenticated === true && !document.hidden) current.current.onUnlock();
      else setError(true);
    } catch {
      // Cancellation/error is terminal for automatic prompting on this lock screen.
      // Only a deliberate click or a new lock session may start another prompt.
      attempted.current = true;
      if (active.current) setError(true);
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
      if (active.current && !attempted.current && generation !== readinessGeneration.current)
        queueMicrotask(() => void authenticate(true));
    }
  }, []);

  useEffect(() => {
    active.current = true;
    if (!enabled || !android) return () => { active.current = false; };
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    const ready = () => { if (!disposed) { readinessGeneration.current++; void authenticate(true); } };
    // Native onResume is authoritative; visibility/focus also cover WebView timing.
    void CalendarDevice.addListener('biometricStateChanged', ready).then(handle => {
      if (disposed) void handle.remove(); else removeListener = () => handle.remove();
      ready();
    }).catch(() => {});
    document.addEventListener('visibilitychange', ready);
    window.addEventListener('focus', ready);
    ready();
    return () => {
      disposed = true; active.current = false;
      document.removeEventListener('visibilitychange', ready);
      window.removeEventListener('focus', ready);
      void removeListener?.();
    };
  }, [enabled, disabled, android, authenticate]);

  if (!enabled || !android) return null;
  return <div className="w-full text-center space-y-2">
    <button type="button" disabled={pending || disabled} onClick={() => void authenticate(false)} className="w-full rounded-xl theme-subtle theme-text border theme-border py-2">{tr(language, 'Użyj biometrii', 'Use biometrics')}</button>
    {error && <p role="alert" className="text-xs text-rose-400">{tr(language, 'Biometria niedostępna lub anulowana. Użyj PIN-u albo hasła.', 'Biometrics unavailable or cancelled. Use your PIN or password.')}</p>}
  </div>;
}
