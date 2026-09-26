import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { 
  X, 
  QrCode, 
  Camera, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  Smartphone, 
  Laptop, 
  RefreshCw, 
  AlertCircle,
  ShieldCheck,
  Zap,
  ZapOff,
  ArrowLeftRight
} from 'lucide-react';
import { CalendarEvent, AppTheme } from '../types';
import { exportEventsToICS, parseICSToEvents } from '../utils/storage';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onSyncMergeEvents: (incomingEvents: CalendarEvent[]) => void;
  currentTheme?: AppTheme;
  onSyncTheme?: (theme: AppTheme) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  events,
  onSyncMergeEvents,
  currentTheme = 'dark',
  onSyncTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'qr-show' | 'qr-scan' | 'text-code' | 'file'>('qr-show');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Camera scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Generate ultra-compact sync payload
  const generateSyncPayload = (): string => {
    try {
      const minimalEvents = events.map((e) => {
        const item: any = {
          id: e.id,
          t: e.title,
          sd: e.startDate,
        };
        if (e.startTime) item.st = e.startTime;
        if (e.endDate && e.endDate !== e.startDate) item.ed = e.endDate;
        if (e.endTime) item.et = e.endTime;
        if (e.allDay) item.ad = 1;
        if (e.color && e.color !== 'peacock') item.c = e.color;
        if (e.location) item.loc = e.location;
        if (e.description) item.d = e.description;
        if (e.reminders && e.reminders.length > 0) item.r = e.reminders;
        if (e.recurrence && e.recurrence !== 'NONE') item.rec = e.recurrence;
        if (e.customRecurrence) item.cr = e.customRecurrence;
        if (e.updatedAt) item.u = e.updatedAt;
        return item;
      });

      return JSON.stringify({ v: 1, app: 'cal-offline', th: currentTheme, e: minimalEvents });
    } catch {
      return '';
    }
  };

  const decodeSyncPayload = (payloadStr: string): { events: CalendarEvent[]; theme?: AppTheme } | null => {
    try {
      const cleanStr = payloadStr.trim();
      const parsed = JSON.parse(cleanStr);
      if (parsed.app !== 'cal-offline' || !Array.isArray(parsed.e)) {
        return null;
      }
      const decodedEvents: CalendarEvent[] = parsed.e.map((item: any) => ({
        id: item.id || 'evt-' + Math.random().toString(36).substring(2, 9),
        title: item.t || 'Bez tytułu',
        startDate: item.sd,
        startTime: item.st || undefined,
        endDate: item.ed || item.sd,
        endTime: item.et || undefined,
        allDay: Boolean(item.ad),
        color: item.c || 'peacock',
        location: item.loc || undefined,
        description: item.d || undefined,
        reminders: item.r || [15],
        recurrence: item.rec || 'NONE',
        customRecurrence: item.cr || undefined,
        createdAt: item.u || Date.now(),
        updatedAt: item.u || Date.now(),
      }));
      return {
        events: decodedEvents,
        theme: parsed.th as AppTheme | undefined,
      };
    } catch {
      return null;
    }
  };

  // Generate high-clarity QR Code when tab is 'qr-show' or events change
  useEffect(() => {
    if (!isOpen) return;
    const payload = generateSyncPayload();
    if (!payload) return;

    QRCode.toDataURL(payload, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.warn('QR Code generation fallback to level L:', err);
        QRCode.toDataURL(payload, { width: 360, margin: 1, errorCorrectionLevel: 'L' })
          .then((url) => setQrDataUrl(url))
          .catch(() => setQrDataUrl(''));
      });
  }, [isOpen, events, activeTab, currentTheme]);

  // Handle Camera scanning
  useEffect(() => {
    if (activeTab !== 'qr-scan' || !isScanning) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [activeTab, isScanning]);

  const startCamera = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      mediaStreamRef.current = stream;

      // Check if torch / flashlight is available
      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any)?.getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable', err);
      setStatusMessage({
        type: 'error',
        text: 'Aparat niedostępny lub brak uprawnień. Możesz użyć wczytania zdjęcia kodu QR lub kodu tekstowego.',
      });
      setIsScanning(false);
    }
  };

  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && (track as any).applyConstraints) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn('Failed to toggle torch', err);
      }
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    setIsTorchOn(false);
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState >= video.HAVE_CURRENT_DATA && ctx) {
      // 1. Try native BarcodeDetector API if supported (sub-millisecond hardware acceleration)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleIncomingData(barcodes[0].rawValue);
            setIsScanning(false);
            stopCamera();
            return;
          }
        } catch {
          // Fallback to jsQR below
        }
      }

      // 2. jsQR engine fallback
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        handleIncomingData(code.data);
        setIsScanning(false);
        stopCamera();
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Process incoming data from QR or text
  const handleIncomingData = (dataStr: string) => {
    if (!dataStr) return;

    // Haptic feedback if available
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    const result = decodeSyncPayload(dataStr);
    if (result && Array.isArray(result.events)) {
      if (result.theme && onSyncTheme) {
        onSyncTheme(result.theme);
      }
      onSyncMergeEvents(result.events);
      setStatusMessage({
        type: 'success',
        text: `Sukces! Zsynchronizowano ${result.events.length} wydarzeń oraz motyw graficzny!`,
      });
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1500);
    } else {
      // Check if it's ICS text
      if (dataStr.includes('BEGIN:VCALENDAR')) {
        const icsEvents = parseICSToEvents(dataStr);
        if (icsEvents.length > 0) {
          onSyncMergeEvents(icsEvents);
          setStatusMessage({
            type: 'success',
            text: `Zsynchronizowano ${icsEvents.length} wydarzeń z pliku kalendarza!`,
          });
          setTimeout(() => {
            onClose();
            setStatusMessage(null);
          }, 1500);
          return;
        }
      }
      setStatusMessage({
        type: 'error',
        text: 'Nieprawidłowy format kodu synchronizacji lub niepełne dane.',
      });
    }
  };

  // Scan from uploaded image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          handleIncomingData(code.data);
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Nie wykryto kodu QR na przesłanym zdjęciu.',
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Copy sync code
  const handleCopyCode = () => {
    const payload = generateSyncPayload();
    navigator.clipboard.writeText(payload);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Paste & apply code
  const handleApplySyncCode = () => {
    if (!syncCodeInput.trim()) return;
    handleIncomingData(syncCodeInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 theme-border border-b flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold theme-text">
                Synchronizacja PC ⇄ Telefon
              </h3>
              <p className="text-xs theme-muted flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                100% Offline • Bez konta i bez chmury
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mx-4 mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex theme-border border-b theme-subtle text-xs font-semibold px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => {
              setIsScanning(false);
              setActiveTab('qr-show');
            }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'qr-show'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Pokaż kod QR
          </button>
          <button
            onClick={() => {
              setActiveTab('qr-scan');
              setIsScanning(true);
            }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'qr-scan'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Camera className="w-4 h-4" />
            Skanuj kod
          </button>
          <button
            onClick={() => {
              setIsScanning(false);
              setActiveTab('text-code');
            }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'text-code'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Copy className="w-4 h-4" />
            Kod tekstowy
          </button>
          <button
            onClick={() => {
              setIsScanning(false);
              setActiveTab('file');
            }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'file'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent theme-muted hover:theme-text'
            }`}
          >
            <Download className="w-4 h-4" />
            Plik .ics
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* TAB 1: Pokaż kod QR */}
          {activeTab === 'qr-show' && (
            <div className="flex flex-col items-center text-center space-y-4">
              {/* White card container so QR code remains 100% scannable by camera regardless of dark mode */}
              <div className="bg-white p-3 sm:p-4 rounded-3xl border border-stone-200 shadow-lg">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Kod QR do synchronizacji kalendarza"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-stone-500 text-xs">
                    Generowanie kodu QR...
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold theme-text flex items-center justify-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-500" />
                  Zeskanuj telefonem, aby przenieść kalendarz
                </h4>
                <p className="text-xs theme-muted max-w-sm">
                  Otwórz tę aplikację na telefonie, wejdź w <strong>Synchronizuj ➔ Skanuj kod</strong> i skieruj aparat na ten ekran. Wszystkie wydarzenia ({events.length}) oraz motyw zostaną zsynchronizowane!
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl theme-subtle theme-hover theme-text text-xs font-semibold transition-colors theme-border border"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {isCopied ? 'Skopiowano kod do schowka!' : 'Kopiuj kod synchronizacji jako tekst'}
              </button>
            </div>
          )}

          {/* TAB 2: Skanuj kod aparatem */}
          {activeTab === 'qr-scan' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-indigo-500 shadow-xl">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Modern Targeting reticle & animated laser line */}
                <div className="absolute inset-4 border-2 border-indigo-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                  </div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-md" />
                  <div className="w-full flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                  </div>
                </div>

                {/* Torch button if supported */}
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full shadow-lg transition-colors ${
                      isTorchOn ? 'bg-amber-400 text-stone-950' : 'bg-black/60 text-white hover:bg-black/80'
                    }`}
                    title="Włącz latarkę"
                  >
                    {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold theme-text">
                  Skieruj aparat na kod QR z komputera
                </h4>
                <p className="text-xs theme-muted max-w-xs">
                  Aparat automatycznie odczyta wydarzenia i bezprzewodowo zaktualizuje Twój kalendarz.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl theme-subtle theme-hover theme-text text-xs font-semibold flex items-center gap-1.5 transition-colors theme-border border"
                >
                  <Upload className="w-4 h-4 opacity-70" />
                  Wgraj zdjęcie kodu QR z galerii
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Kod tekstowy (Kopiuj-Wklej) */}
          {activeTab === 'text-code' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20 text-xs text-blue-400 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  Kopiuj-Wklej między urządzeniami
                </p>
                <p className="text-blue-300">
                  Możesz skopiować kod synchronizacji z komputera i wkleić go na telefonie (lub odwrotnie).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold theme-text block">
                  Wklej kod otrzymany z drugiego urządzenia:
                </label>
                <textarea
                  rows={4}
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                  placeholder="Wklej tutaj wygenerowany kod synchronizacji..."
                  className="w-full text-xs font-mono p-3 rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleApplySyncCode}
                  disabled={!syncCodeInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Zastosuj i zsynchronizuj kalendarz
                </button>
              </div>

              <div className="pt-3 theme-border border-t flex items-center justify-between">
                <span className="text-xs theme-muted">Twój aktualny kod:</span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-xl theme-subtle theme-hover theme-text text-xs font-semibold flex items-center gap-1 theme-border border"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Skopiowano!' : 'Kopiuj mój kod'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Plik ICS */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl theme-subtle theme-border border space-y-2">
                <p className="text-xs theme-text leading-relaxed">
                  Możesz pobrać wszystkie swoje wydarzenia jako uniwersalny plik <strong>.ics</strong> i otworzyć go na dowolnym telefonie lub komputerze.
                </p>
                <button
                  onClick={() => exportEventsToICS(events)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Pobierz plik kalendarza (.ics)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
