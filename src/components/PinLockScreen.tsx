import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

interface PinLockScreenProps {
  correctPin: string;
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ correctPin, onUnlock }) => {
  const [pinInput, setPinInput] = useState('');
  const [isError, setIsError] = useState(false);

  const handleDigitPress = (digit: string) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    setIsError(false);

    if (next.length === 4) {
      if (next === correctPin) {
        onUnlock();
      } else {
        setIsError(true);
        setTimeout(() => {
          setPinInput('');
          setIsError(false);
        }, 800);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setIsError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="max-w-xs w-full flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-blue-400">
          <Lock className="w-8 h-8" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Kalendarz zablokowany</h2>
          <p className="text-xs text-stone-400 mt-1">Wpisz 4-cyfrowy kod PIN, aby uzyskać dostęp</p>
        </div>

        {/* Pin Dots Indicator */}
        <div className={`flex items-center gap-4 py-2 ${isError ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                isError
                  ? 'bg-red-500 scale-110'
                  : pinInput.length > idx
                  ? 'bg-blue-500 scale-110'
                  : 'bg-stone-700'
              }`}
            />
          ))}
        </div>

        {isError && (
          <p className="text-xs text-red-400 font-medium">Niepoprawny kod PIN</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              id={`pin-key-${digit}`}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-14 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-xl font-semibold flex items-center justify-center transition-colors shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPinInput('')}
            className="h-14 rounded-2xl bg-stone-800/60 hover:bg-stone-800 text-xs font-medium text-stone-400 flex items-center justify-center"
          >
            Wyczyść
          </button>
          <button
            id="pin-key-0"
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-14 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-xl font-semibold flex items-center justify-center transition-colors shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-stone-800/60 hover:bg-stone-800 text-stone-300 flex items-center justify-center transition-colors"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
