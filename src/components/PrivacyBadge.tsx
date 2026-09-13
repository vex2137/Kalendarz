import React, { useState } from 'react';
import { ShieldCheck, WifiOff, Lock, CheckCircle2, X } from 'lucide-react';

export const PrivacyBadge: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        id="btn-privacy-status"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs"
        title="Kliknij, aby zobaczyć szczegóły prywatności offline"
      >
        <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
        <span className="hidden sm:inline">Tryb offline:</span>
        <span className="font-semibold">0 wysyłanych danych</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            id="modal-privacy-audit"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">Gwarancja 100% Prywatności</h3>
                  <p className="text-xs text-stone-700">Zero Telemetrii • Zero Chmury</p>
                </div>
              </div>
              <button 
                id="btn-close-privacy-modal"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-stone-700 hover:text-stone-900 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm text-stone-700">
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-stone-900">100% Danych na Twoim urządzeniu</div>
                  <div className="text-xs text-stone-700 mt-0.5">Wszystkie wydarzenia, notatki i ustawienia są zapisywane wyłącznie w pamięci telefonu (IndexedDB / LocalStorage).</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-stone-900">Lokalne AI (Gemma 2 2B)</div>
                  <div className="text-xs text-stone-700 mt-0.5">Model sztucznej inteligencji przetwarza polecenia i tekst bezpośrednio na procesorze Twojego urządzenia. Ani jedno słowo nie jest wysyłane na zewnętrzne serwery.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-stone-900">Brak analityki i trackerów</div>
                  <div className="text-xs text-stone-700 mt-0.5">Kod źródłowy nie zawiera skryptów Google Analytics, Facebook Pixel, Sentry ani żadnych innych bibliotek telemetrycznych.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-stone-900">Opcjonalna ochrona kodem PIN</div>
                  <div className="text-xs text-stone-700 mt-0.5">W ustawieniach możesz włączyć 4-cyfrowy kod PIN, aby nikt niepowołany nie otworzył Twojego terminarza.</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                id="btn-privacy-ok"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Rozumiem i akceptuję
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
