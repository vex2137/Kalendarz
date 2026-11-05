import { tr } from '../utils/i18n';
import { BiometricUnlockButton } from './BiometricUnlockButton';
import React, { useEffect, useRef, useState } from 'react';
import { Shield, Delete } from 'lucide-react';
import { AppLanguage, getTranslation } from '../utils/i18n';
import type { AnimationSettings, SecuritySettings } from '../types';
import { verifyPin } from '../utils/security';
import { reducedMotion } from '../utils/animations';

interface PinLockScreenProps {
  security: SecuritySettings;
  animations: AnimationSettings;
  onUnlock: () => void;
  language?: AppLanguage;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  security,
  animations,
  onUnlock,
  language = 'pl',
}) => {
  const t = getTranslation(language);
  const pinLength = Number.isInteger(security.pinLength) && security.pinLength! >= 4 && security.pinLength! <= 16 ? security.pinLength! : 4;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (unlockTimer.current) clearTimeout(unlockTimer.current); }, []);
  const [blockedUntil, setBlockedUntil] = useState(() =>
    Number(localStorage.getItem('pin-blocked-until') || 0),
  );

  const handleDigit = async (digit: string) => {
    if (busy || Date.now() < blockedUntil) return;
    if (pin.length < pinLength) {
      const next = pin + digit;
      setPin(next);
      if (next.length === pinLength) {
        setBusy(true);
        if (await verifyPin(next, security)) {
          localStorage.removeItem('pin-failures');
          localStorage.removeItem('pin-blocked-until');
          if (animations.level !== 'off' && animations.pinUnlock && !reducedMotion()) {
            setSuccess(true);
            unlockTimer.current = setTimeout(onUnlock, 500 * 100 / animations.speed);
            return;
          }
          onUnlock();
        } else {
          const failures =
            Number(localStorage.getItem('pin-failures') || 0) + 1;
          localStorage.setItem('pin-failures', String(failures));
          if (failures >= 5) {
            const until = Date.now() + Math.min(300000, 30000 * (failures - 4));
            setBlockedUntil(until);
            localStorage.setItem('pin-blocked-until', String(until));
          }
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
        setBusy(false);
      }
    }
  };

  const handleDelete = () => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-xs flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg">
          <Shield className="w-8 h-8" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold">{t.pinLockedTitle}</h2>
          <p className="text-xs text-neutral-400">{t.pinEnterCode}</p>
        </div>

        {/* Dots */}
        <div className={`flex flex-wrap justify-center items-center gap-3 py-2 pin-dots ${success ? 'pin-dots-success' : ''}`}>
          {Array.from({ length: pinLength }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                pin.length > i
                  ? error
                    ? 'bg-rose-500 scale-110'
                    : 'bg-blue-500 scale-110'
                  : 'bg-neutral-800 border border-neutral-700'
              }`}
            />
          ))}
        </div>

        {success && <div className="pin-success" role="status" aria-label={tr(language, 'Odblokowano', 'Unlocked')}>
          <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" className="pin-success-track"/><circle cx="20" cy="20" r="16" pathLength="100" className="pin-success-ring"/></svg>
          <span className="pin-success-check" aria-hidden="true">✓</span>
          {animations.level === 'full' && animations.confetti && <span className="pin-confetti" aria-hidden="true">✦ · ✧</span>}
        </div>}

        {error && (
          <p role="alert" className="text-xs text-rose-400 font-semibold">
            {Date.now() < blockedUntil
              ? tr(language, 'Zbyt wiele prób. Odczekaj chwilę.', 'Too many attempts. Please wait.')
              : t.pinIncorrect}
          </p>
        )}

        <BiometricUnlockButton enabled={!!security.biometricEnabled} disabled={busy} language={language} onUnlock={onUnlock} />

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={busy}
              onClick={() => void handleDigit(digit)}
              className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-lg font-bold border border-neutral-800 transition-colors shadow-xs"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDigit('0')}
            className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-lg font-bold border border-neutral-800 transition-colors shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            aria-label={tr(language, 'Usuń cyfrę', 'Delete digit')}
            className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 flex items-center justify-center border border-neutral-800 transition-colors shadow-xs"
          >
            <Delete
              aria-label="Delete / Usuń"
              className="w-5 h-5 text-neutral-400"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
