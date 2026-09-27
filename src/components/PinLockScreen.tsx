import React, { useState } from 'react';
import { Shield, Delete } from 'lucide-react';
import { AppLanguage, getTranslation } from '../utils/i18n';

interface PinLockScreenProps {
  correctPin: string;
  onUnlock: () => void;
  language?: AppLanguage;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  correctPin,
  onUnlock,
  language = 'pl',
}) => {
  const t = getTranslation(language);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        if (next === correctPin) {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
    }
  };

  const handleDelete = () => {
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
        <div className="flex items-center gap-4 py-2">
          {[0, 1, 2, 3].map((i) => (
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

        {error && (
          <p className="text-xs text-rose-400 font-semibold animate-shake">
            {t.pinIncorrect}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-lg font-bold border border-neutral-800 transition-colors shadow-xs"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-lg font-bold border border-neutral-800 transition-colors shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 flex items-center justify-center border border-neutral-800 transition-colors shadow-xs"
          >
            <Delete className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
