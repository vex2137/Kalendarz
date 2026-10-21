import { featureText as ft } from '../utils/featureCopy';
import { tr } from '../utils/i18n';
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import type { CalendarEvent, AppTheme, CustomTheme } from '../types';
import type { Deletion } from '../utils/calendarStore';
import {
  encodeSync,
  decodeSync,
  QRAssembler,
  isEncryptedSync,
  SyncCryptoError,
  type SyncPayload,
} from '../utils/sync';
import { parseICSToEvents, downloadFile } from '../utils/storage';
import { MAX_IMPORT_BYTES } from '../utils/validation';
import { Dialog } from './Dialog';
import type { AppLanguage } from '../utils/i18n';
const EMPTY_DELETIONS: Deletion[] = [];
interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  deletions?: Deletion[];
  onSyncMergeEvents: (
    events: CalendarEvent[],
    deletions?: Deletion[],
  ) => void | Promise<void>;
  currentTheme?: AppTheme;
  currentCustomTheme?: CustomTheme;
  onSyncTheme?: (theme: AppTheme, customTheme?: CustomTheme) => boolean | void;
  language?: AppLanguage;
}
export function SyncModal({
  onClose,
  events,
  deletions = EMPTY_DELETIONS,
  onSyncMergeEvents,
  currentTheme = 'dark',
  currentCustomTheme,
  onSyncTheme,
  language = 'pl',
}: Props) {
  const [sendPassword, setSendPassword] = useState('');
  const [receivePassword, setReceivePassword] = useState('');
  const [pendingEncrypted, setPendingEncrypted] = useState('');
  const [pendingPlain, setPendingPlain] = useState<SyncPayload | null>(null);
  const [generating, setGenerating] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const receiving = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++generation.current; }; }, []);
  const errorText = (error: unknown) => error instanceof SyncCryptoError ? ft(language, error.message as Parameters<typeof ft>[1]) : String(error);
  const [tab, setTab] = useState<'show' | 'scan' | 'code' | 'file'>('show');
  const [includeHolidays, setIncludeHolidays] = useState(false);
  const [encoded, setEncoded] = useState<{
    code: string;
    frames: string[];
  } | null>(null);
  const [frame, setFrame] = useState(0),
    [auto, setAuto] = useState(false),
    [qr, setQr] = useState('');
  const [input, setInput] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false),
    [torch, setTorch] = useState(false),
    [hasTorch, setHasTorch] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null);
  const assembler = useRef(new QRAssembler());
  const payload = useMemo<SyncPayload>(
    () => ({
      v: 2,
      app: 'cal-offline',
      events: includeHolidays
        ? events
        : events.filter((e) => !e.id.startsWith('pl-holiday-')),
      deletions,
      theme: currentTheme,
      ...(currentCustomTheme ? { customTheme: currentCustomTheme } : {}),
    }),
    [events, deletions, currentTheme, currentCustomTheme, includeHolidays],
  );
  useEffect(() => {
    ++generation.current;
    setEncoded(null); setQr(''); setGenerating(false); setAuto(false);
  }, [payload]);
  async function generate() {
    if (generating) return;
    const token = ++generation.current;
    setGenerating(true); setEncoded(null); setQr(''); setStatus('');
    try {
      const result = await encodeSync(payload, sendPassword);
      if (alive.current && generation.current === token) { setEncoded(result); setFrame(0); setSendPassword(''); }
    } catch (error) {
      if (alive.current && generation.current === token) setStatus(errorText(error));
    } finally { if (alive.current && generation.current === token) setGenerating(false); }
  }
  const frameText = encoded?.frames[frame];
  useEffect(() => {
    setQr('');
    if (tab !== 'show' || !frameText) return;
    let active = true;
    void QRCode.toDataURL(frameText, {
      width: 360,
      margin: 4,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch((e) => {
        if (active) setStatus(String(e));
      });
    return () => {
      active = false;
    };
  }, [tab, frameText]);
  useEffect(() => {
    if (!auto || !encoded?.frames.length || tab !== 'show') return;
    const timer = setInterval(
      () => setFrame((n) => (n + 1) % encoded.frames.length),
      1500,
    );
    return () => clearInterval(timer);
  }, [auto, encoded, tab]);
  const incoming = useCallback(async (original: string) => {
    if (receiving.current) return;
    let data = original;
    try {
      if (/^KAL[23]P:/.test(data)) {
        const result = assembler.current.add(data);
        setStatus(`${result.received}/${result.total} ${tr(language, 'części QR', 'QR parts')}`);
        if (!result.code) return;
        data = result.code;
      }
      setScanning(false);
      if (isEncryptedSync(data)) {
        setPendingEncrypted(data); setReceivePassword(''); setPendingPlain(null);
        setStatus(ft(language, 'Encrypted data received. Enter the sender’s password.'));
      } else {
        const decoded: SyncPayload = data.includes('BEGIN:VCALENDAR')
          ? { v: 2, app: 'cal-offline', events: parseICSToEvents(data), deletions: [] }
          : await decodeSync(data);
        if (!alive.current) return;
        setPendingPlain(decoded); setPendingEncrypted(''); setReceivePassword('');
        setStatus(ft(language, 'Ready to import unencrypted data.'));
      }
    } catch (error) { if (alive.current) setStatus(errorText(error)); }
  }, [language]);
  async function mergeIncoming() {
    if (receiving.current) return;
    receiving.current = true; setBusy(true); setStatus('');
    try {
      const decoded = pendingEncrypted ? await decodeSync(pendingEncrypted, receivePassword) : pendingPlain;
      if (!decoded || !alive.current) return;
      await onSyncMergeEvents(decoded.events, decoded.deletions);
      if (!alive.current) return;
      if (decoded.theme && onSyncTheme?.(decoded.theme, decoded.customTheme) === false) throw new SyncCryptoError('Could not save the theme.');
      setPendingEncrypted(''); setPendingPlain(null); setReceivePassword(''); setInput('');
      assembler.current = new QRAssembler();
      setStatus(tr(language, 'Zapisano i scalono dane.', 'Data saved and merged.'));
    } catch (error) {
      if (alive.current) { setStatus(errorText(error)); setReceivePassword(''); }
    } finally { receiving.current = false; if (alive.current) setBusy(false); }
  }
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;
  useEffect(() => {
    if (tab !== 'scan' || !scanning) return;
    let cancelled = false,
      raf = 0,
      last = 0,
      working = false;
    let ownStream: MediaStream | null = null;
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    let detector: InstanceType<NonNullable<typeof Detector>> | null = null;
    try {
      if (Detector) detector = new Detector({ formats: ['qr_code'] });
    } catch {
      /* Use jsQR when native QR detection is unsupported. */
    }
    const scan = async (time: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(scan);
      if (
        working ||
        time - last < 200 ||
        !video.current ||
        video.current.readyState < 2
      )
        return;
      working = true;
      last = time;
      try {
        let data = '';
        if (detector) {
          try {
            data = (await detector.detect(video.current))[0]?.rawValue || '';
          } catch {
            detector = null;
          }
        }
        if (!detector && canvas.current) {
          const v = video.current,
            c = canvas.current,
            scale = Math.min(1, 800 / v.videoWidth);
          const width = Math.round(v.videoWidth * scale),
            height = Math.round(v.videoHeight * scale);
          if (c.width !== width || c.height !== height) {
            c.width = width;
            c.height = height;
          }
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, width, height);
            const image = ctx.getImageData(0, 0, width, height);
            data =
              jsQR(image.data, width, height, {
                inversionAttempts: 'dontInvert',
              })?.data || '';
          }
        }
        if (data && !cancelled) await incomingRef.current(data);
      } catch (error) {
        if (!cancelled) {
          setStatus(String(error));
          setScanning(false);
        }
      } finally {
        working = false;
      }
    };
    void (async () => {
      try {
        ownStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 800 },
            height: { ideal: 600 },
          },
        });
        if (cancelled) {
          ownStream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = ownStream;
        setHasTorch(
          'torch' in (ownStream.getVideoTracks()[0]?.getCapabilities?.() || {}),
        );
        if (video.current) {
          video.current.srcObject = ownStream;
          await video.current.play();
          if (!cancelled) raf = requestAnimationFrame(scan);
        }
      } catch (e) {
        if (!cancelled) {
          setStatus(
            `${tr(language, 'Aparat niedostępny. Użyj zdjęcia lub pliku.', 'Camera unavailable. Use an image or file.')} ${String(e)}`,
          );
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ownStream?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
      setTorch(false);
    };
  }, [tab, scanning, language]);
  const readFile = async (file?: File, image = false) => {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error(
          tr(language, 'Maksymalny rozmiar: 10 MB', 'Maximum size: 10 MB'),
        );
      if (image) {
        const bitmap = await createImageBitmap(file);
        try {
          if (bitmap.width * bitmap.height > 40_000_000)
            throw new Error('Image too large');
          const scale = Math.min(
            1,
            1280 / Math.max(bitmap.width, bitmap.height),
          );
          const c = document.createElement('canvas');
          c.width = Math.round(bitmap.width * scale);
          c.height = Math.round(bitmap.height * scale);
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(bitmap, 0, 0, c.width, c.height);
          const pixels = ctx.getImageData(0, 0, c.width, c.height);
          const result = jsQR(pixels.data, c.width, c.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (!result)
            throw new Error(tr(language, 'Nie znaleziono QR', 'No QR found'));
          await incoming(result.data);
        } finally {
          bitmap.close();
        }
      } else await incoming(await file.text());
    } catch (e) {
      setStatus(String(e));
    }
  };
  const tabs = [
    ['show', tr(language, 'Pokaż QR', 'Show QR')],
    ['scan', tr(language, 'Skanuj', 'Scan')],
    ['code', tr(language, 'Kod tekstowy', 'Text code')],
    ['file', tr(language, 'Plik', 'File')],
  ] as const;
  return (
    <Dialog
      onClose={onClose}
      label={tr(language, 'Synchronizacja', 'Sync')}
      className="fixed inset-0 z-50 bg-black/60 p-3 flex items-center justify-center"
    >
      <div className="theme-surface theme-border border rounded-2xl max-w-lg w-full max-h-[92dvh] overflow-auto p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">
            {tr(language, 'Synchronizacja PC ⇄ Telefon', 'PC ⇄ Phone sync')}
          </h3>
          <button
            aria-label={tr(language, 'Zamknij', 'Close')}
            onClick={onClose}
            className="p-2"
          >
            ✕
          </button>
        </div>
        <p className="text-xs theme-muted">
          {ft(language, 'QR sync is encrypted. Share the password separately. Plain JSON file exports are not encrypted.')}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => {
                setScanning(false);
                setTab(id);
                setStatus('');
              }}
              className={`p-2 rounded-lg text-xs ${tab === id ? 'theme-primary bg-blue-600 text-white' : 'theme-subtle'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p role="status" className="text-xs break-words">
          {status}
        </p>
        {(pendingEncrypted || pendingPlain) && <div className="theme-border border rounded-xl p-3 space-y-2" data-testid="incoming-sync">
          {pendingEncrypted ? <label className="block text-xs">{ft(language, 'Sender’s password')}
            <input type="password" autoComplete="off" spellCheck={false} value={receivePassword} disabled={busy} maxLength={256}
              onChange={event => setReceivePassword(event.target.value)} className="theme-input w-full rounded p-2 mt-1" />
          </label> : <p className="text-xs">{ft(language, 'Legacy unencrypted data. Merge only if you trust the sender.')}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="theme-primary bg-blue-600 text-white rounded p-2 text-xs" disabled={busy || Boolean(pendingEncrypted && !receivePassword)} onClick={() => void mergeIncoming()}>
              {busy ? ft(language, 'Decrypting…') : pendingEncrypted ? ft(language, 'Decrypt and merge') : ft(language, 'Merge unencrypted data')}
            </button>
            <button type="button" className="theme-input rounded p-2 text-xs" disabled={busy} onClick={() => {
              setPendingEncrypted(''); setPendingPlain(null); setReceivePassword(''); setStatus(''); assembler.current = new QRAssembler();
            }}>{ft(language, 'Cancel')}</button>
          </div>
        </div>}
        {(tab === 'show' || tab === 'code') && <div className="space-y-2">
          <label className="block text-xs">{ft(language, 'Sync password')}
            <input type="password" autoComplete="new-password" spellCheck={false} value={sendPassword} maxLength={256} disabled={generating}
              onChange={event => { setSendPassword(event.target.value); setEncoded(null); setQr(''); }} className="theme-input w-full rounded p-2 mt-1" />
          </label>
          <p className="text-xs theme-muted">{ft(language, 'Use at least 12 characters. The password is not saved.')}</p>
          <button type="button" className="theme-primary bg-blue-600 text-white rounded p-2 text-xs" disabled={generating || sendPassword.length < 12} onClick={() => void generate()}>
            {ft(language, generating ? 'Encrypting…' : 'Generate encrypted code')}
          </button>
        </div>}
        {(tab === 'show' || tab === 'code') && (
          <label className="block text-xs">
            <input
              type="checkbox"
              checked={includeHolidays}
              onChange={(e) => setIncludeHolidays(e.target.checked)}
            />{' '}
            {tr(language, 'Dołącz polskie święta', 'Include Polish holidays')}
          </label>
        )}
        {tab === 'show' && (
          <div className="text-center space-y-2">
            {qr && frameText ? (
              <img
                src={qr}
                width={360}
                height={360}
                alt={tr(language, 'Kod synchronizacji', 'Sync QR')}
                className="mx-auto max-w-full rounded-lg"
              />
            ) : (
              <p>
                {encoded && !encoded.frames.length
                  ? tr(language, 'Zbyt dużo danych na QR — użyj pliku.', 'Too much data for QR — use a file.')
                  : ft(language, generating ? 'Encrypting…' : 'Enter a password to generate encrypted QR codes.')}
              </p>
            )}
            {!!encoded?.frames.length && (
              <>
                <p className="text-xs">
                  {frame + 1}/{encoded.frames.length}
                </p>
                {encoded.frames.length > 1 && (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() =>
                        setFrame(
                          (n) =>
                            (n - 1 + encoded.frames.length) %
                            encoded.frames.length,
                        )
                      }
                      aria-label="Previous QR"
                    >
                      ←
                    </button>
                    <button onClick={() => setAuto((v) => !v)}>
                      {auto
                        ? tr(language, 'Wstrzymaj', 'Pause')
                        : tr(language, 'Odtwarzaj kody', 'Play QR codes')}
                    </button>
                    <button
                      onClick={() =>
                        setFrame((n) => (n + 1) % encoded.frames.length)
                      }
                      aria-label="Next QR"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {tab === 'scan' && (
          <div className="space-y-2">
            <button
              className="theme-input p-2 rounded"
              onClick={() => setScanning((v) => !v)}
            >
              {scanning
                ? tr(language, 'Zatrzymaj aparat', 'Stop camera')
                : tr(language, 'Uruchom aparat', 'Start camera')}
            </button>
            <video
              ref={video}
              muted
              playsInline
              className="w-full rounded-lg"
            />
            <canvas ref={canvas} className="hidden" />
            {hasTorch && scanning && (
              <button
                aria-pressed={torch}
                onClick={async () => {
                  try {
                    const next = !torch;
                    await stream.current?.getVideoTracks()[0].applyConstraints({
                      advanced: [{ torch: next } as MediaTrackConstraintSet],
                    });
                    setTorch(next);
                  } catch (e) {
                    setStatus(String(e));
                  }
                }}
              >
                {tr(language, 'Latarka', 'Torch')}
              </button>
            )}
            <label className="block text-xs">
              {tr(language, 'Wczytaj zdjęcie QR', 'Upload QR image')}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void readFile(e.target.files?.[0], true)}
              />
            </label>
          </div>
        )}
        {tab === 'code' && (
          <div className="space-y-2">
            <button
              disabled={!encoded}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(encoded!.code);
                  setStatus(tr(language, 'Skopiowano', 'Copied'));
                } catch (e) {
                  setStatus(String(e));
                }
              }}
              className="theme-input p-2 rounded"
            >
              {tr(language, 'Kopiuj mój kod', 'Copy my code')}
            </button>
            <textarea
              aria-label={
                tr(language, 'Kod z drugiego urządzenia', 'Code from other device')
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_IMPORT_BYTES * 2}
              className="theme-input w-full rounded p-2 h-28"
            />
            <button
              disabled={busy || !input.trim()}
              onClick={() => void incoming(input.trim())}
              className="theme-primary bg-blue-600 text-white rounded p-2"
            >
              {tr(language, 'Scal dane', 'Merge data')}
            </button>
          </div>
        )}
        {tab === 'file' && (
          <div className="space-y-3">
            <button
              onClick={() =>
                downloadFile(JSON.stringify(payload), 'kalendarz-sync.json')
              }
              className="theme-input p-2 rounded"
            >
              {tr(language, 'Eksportuj pełny pakiet', 'Export full package')}
            </button>
            <label className="block text-sm">
              {tr(language, 'Importuj JSON lub ICS (scalanie)', 'Import JSON or ICS (merge)')}
              <input
                type="file"
                accept=".json,.ics"
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
            </label>
          </div>
        )}
      </div>
    </Dialog>
  );
}
