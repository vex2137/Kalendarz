import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Shield } from 'lucide-react';
import { BiometricUnlockButton } from './BiometricUnlockButton';
import type { AnimationSettings, SecuritySettings } from '../types';
import { verifyPassword } from '../utils/security';
import { reducedMotion } from '../utils/animations';
import { tr, type AppLanguage } from '../utils/i18n';

export function PasswordLockScreen({security, animations, onUnlock, language}: {
  security: SecuritySettings; animations: AnimationSettings; onUnlock: () => void; language: AppLanguage;
}) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const blockedUntil = Number(localStorage.getItem('pin-blocked-until') || 0);
    if (Date.now() < blockedUntil) { setError(tr(language, 'Zbyt wiele prób. Odczekaj chwilę.', 'Too many attempts. Please wait.')); return; }
    setBusy(true);
    try {
      const verified = await verifyPassword(password, security);
      if (!active.current) return;
      if (verified) {
        localStorage.removeItem('pin-failures'); localStorage.removeItem('pin-blocked-until');
        if (animations.level !== 'off' && !reducedMotion()) {
          setSuccess(true); timer.current = setTimeout(onUnlock, 160 * 100 / animations.speed); return;
        }
        onUnlock(); return;
      }
      const failures = Number(localStorage.getItem('pin-failures') || 0) + 1;
      localStorage.setItem('pin-failures', String(failures));
      if (failures >= 5) localStorage.setItem('pin-blocked-until', String(Date.now() + Math.min(300000, 30000 * (failures - 4))));
      setPassword(''); setError(tr(language, 'Nieprawidłowe hasło.', 'Incorrect password.'));
    } catch {
      setError(tr(language, 'Nie udało się sprawdzić hasła.', 'Could not verify password.'));
    }
    setBusy(false);
  };
  return <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex items-center justify-center p-4">
    <form onSubmit={event => void submit(event)} className={`w-full max-w-xs flex flex-col items-center gap-4 ${success ? 'password-success' : ''}`}>
      <Shield className="w-10 h-10 text-blue-400" />
      <h2 className="text-lg font-bold">{tr(language, 'Kalendarz zablokowany', 'Calendar Locked')}</h2>
      <label className="w-full text-sm">{tr(language, 'Hasło', 'Password')}
        <input autoFocus type={show ? 'text' : 'password'} autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="block w-full rounded-xl px-3 py-2 theme-input" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} />{tr(language, 'Pokaż hasło', 'Show password')}</label>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <BiometricUnlockButton enabled={!!security.biometricEnabled} disabled={busy} language={language} onUnlock={onUnlock} />
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3">{tr(language, 'Odblokuj', 'Unlock')}</button>
    </form>
  </div>;
}
