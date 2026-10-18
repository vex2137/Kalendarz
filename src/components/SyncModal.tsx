import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import type { CalendarEvent, AppTheme } from '../types';
import type { Deletion } from '../utils/calendarStore';
import {
  encodeSync,
  decodeSync,
  QRAssembler,
  type SyncPayload,
} from '../utils/sync';
import { parseICSToEvents, downloadFile } from '../utils/storage';
import { MAX_IMPORT_BYTES } from '../utils/validation';
import { Dialog } from './Dialog';
import type { AppLanguage } from '../utils/i18n';
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
  onSyncTheme?: (theme: AppTheme) => void;
  language?: AppLanguage;
}
export function SyncModal({
  onClose,
  events,
  deletions = [],
  onSyncMergeEvents,
  currentTheme = 'dark',
  onSyncTheme,
  language = 'pl',
}: Props) {
  const pl = language === 'pl';
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
    }),
    [events, deletions, currentTheme, includeHolidays],
  );
  const wantsCode = tab === 'show' || tab === 'code';
  useEffect(() => {
    if (!wantsCode) return;
    let active = true;
    setEncoded(null);
    void encodeSync(payload)
      .then((result) => {
        if (active) {
          setEncoded(result);
          setFrame(0);
        }
      })
      .catch((e) => {
        if (active) setStatus(String(e));
      });
    return () => {
      active = false;
    };
  }, [payload, wantsCode]);
  const frameText = encoded?.frames[frame];
  useEffect(() => {
    if (tab !== 'show' || !frameText) return;
    let active = true;
    void QRCode.toDataURL(frameText, {
      width: 360,
      margin: 2,
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
  const incoming = useCallback(
    async (data: string) => {
      if (busy) return;
      try {
        if (data.startsWith('KAL2P:')) {
          const result = assembler.current.add(data);
          setStatus(
            `${result.received}/${result.total} ${pl ? 'części QR' : 'QR parts'}`,
          );
          if (!result.code) return;
          data = result.code;
        }
        setBusy(true);
        if (data.includes('BEGIN:VCALENDAR')) {
          await onSyncMergeEvents(parseICSToEvents(data));
        } else {
          const decoded = await decodeSync(data);
          await onSyncMergeEvents(decoded.events, decoded.deletions);
          if (decoded.theme) onSyncTheme?.(decoded.theme);
        }
        setScanning(false);
        setStatus(pl ? 'Zapisano i scalono dane.' : 'Data saved and merged.');
      } catch (e) {
        setStatus(String(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, onSyncMergeEvents, onSyncTheme, pl],
  );
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
            `${pl ? 'Aparat niedostępny. Użyj zdjęcia lub pliku.' : 'Camera unavailable. Use an image or file.'} ${String(e)}`,
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
  }, [tab, scanning, pl]);
  const readFile = async (file?: File, image = false) => {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error(
          pl ? 'Maksymalny rozmiar: 10 MB' : 'Maximum size: 10 MB',
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
            throw new Error(pl ? 'Nie znaleziono QR' : 'No QR found');
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
    ['show', pl ? 'Pokaż QR' : 'Show QR'],
    ['scan', pl ? 'Skanuj' : 'Scan'],
    ['code', pl ? 'Kod tekstowy' : 'Text code'],
    ['file', pl ? 'Plik' : 'File'],
  ] as const;
  return (
    <Dialog
      onClose={onClose}
      label={pl ? 'Synchronizacja' : 'Sync'}
      className="fixed inset-0 z-50 bg-black/60 p-3 flex items-center justify-center"
    >
      <div className="theme-surface theme-border border rounded-2xl max-w-lg w-full max-h-[92dvh] overflow-auto p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">
            {pl ? 'Synchronizacja PC ⇄ Telefon' : 'PC ⇄ Phone sync'}
          </h3>
          <button
            aria-label={pl ? 'Zamknij' : 'Close'}
            onClick={onClose}
            className="p-2"
          >
            ✕
          </button>
        </div>
        <p className="text-xs theme-muted">
          {pl
            ? 'Dane są kompresowane, nie szyfrowane. Udostępniaj je zaufanym osobom.'
            : 'Data is compressed, not encrypted. Share it only with people you trust.'}
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
              className={`p-2 rounded-lg text-xs ${tab === id ? 'bg-blue-600 text-white' : 'theme-subtle'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p role="status" className="text-xs break-words">
          {status}
        </p>
        {(tab === 'show' || tab === 'code') && (
          <label className="block text-xs">
            <input
              type="checkbox"
              checked={includeHolidays}
              onChange={(e) => setIncludeHolidays(e.target.checked)}
            />{' '}
            {pl ? 'Dołącz polskie święta' : 'Include Polish holidays'}
          </label>
        )}
        {tab === 'show' && (
          <div className="text-center space-y-2">
            {qr && frameText ? (
              <img
                src={qr}
                width={360}
                height={360}
                alt={pl ? 'Kod synchronizacji' : 'Sync QR'}
                className="mx-auto max-w-full rounded-lg"
              />
            ) : (
              <p>
                {encoded && !encoded.frames.length
                  ? pl
                    ? 'Zbyt dużo danych na QR — użyj pliku.'
                    : 'Too much data for QR — use a file.'
                  : pl
                    ? 'Przygotowywanie…'
                    : 'Preparing…'}
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
                        ? pl
                          ? 'Wstrzymaj'
                          : 'Pause'
                        : pl
                          ? 'Odtwarzaj kody'
                          : 'Play QR codes'}
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
                ? pl
                  ? 'Zatrzymaj aparat'
                  : 'Stop camera'
                : pl
                  ? 'Uruchom aparat'
                  : 'Start camera'}
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
                {pl ? 'Latarka' : 'Torch'}
              </button>
            )}
            <label className="block text-xs">
              {pl ? 'Wczytaj zdjęcie QR' : 'Upload QR image'}
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
                  setStatus(pl ? 'Skopiowano' : 'Copied');
                } catch (e) {
                  setStatus(String(e));
                }
              }}
              className="theme-input p-2 rounded"
            >
              {pl ? 'Kopiuj mój kod' : 'Copy my code'}
            </button>
            <textarea
              aria-label={
                pl ? 'Kod z drugiego urządzenia' : 'Code from other device'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_IMPORT_BYTES * 2}
              className="theme-input w-full rounded p-2 h-28"
            />
            <button
              disabled={busy || !input.trim()}
              onClick={() => void incoming(input.trim())}
              className="bg-blue-600 text-white rounded p-2"
            >
              {pl ? 'Scal dane' : 'Merge data'}
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
              {pl ? 'Eksportuj pełny pakiet' : 'Export full package'}
            </button>
            <label className="block text-sm">
              {pl
                ? 'Importuj JSON lub ICS (scalanie)'
                : 'Import JSON or ICS (merge)'}
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
