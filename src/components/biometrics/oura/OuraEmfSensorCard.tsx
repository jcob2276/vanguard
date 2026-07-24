import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Magnet, ShieldCheck, ShieldAlert, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { readMagnetometerEMF } from '../../../lib/native/emfSensor';

export function OuraEmfSensorCard() {
  const [key, setKey] = useState(0);

  const query = useQuery({
    queryKey: ['emf-reading', key],
    queryFn: () => readMagnetometerEMF(),
    staleTime: Infinity,
  });

  const reading = query.data ?? null;
  const measuring = query.isFetching;

  const isHardwareAvailable = reading?.hardwareAvailable ?? false;
  const total = reading?.totalMicroTesla ?? null;
  const status = reading?.status ?? 'no_sensor';

  const badgeColor =
    status === 'high'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      : status === 'moderate'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : status === 'safe'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : 'bg-slate-800 text-slate-400 border-white/10';

  const barColor =
    status === 'high' ? 'bg-rose-400' : status === 'moderate' ? 'bg-amber-400' : status === 'safe' ? 'bg-emerald-400' : 'bg-slate-600';

  const StatusIcon = status === 'safe' ? ShieldCheck : status === 'no_sensor' ? AlertCircle : ShieldAlert;

  const val = total ?? 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Magnet size={16} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-slate-300 font-display">
              Magnetometr & Pole EMF w Sypialni
            </h4>
            <p className="text-3xs text-slate-400">
              Sprzętowa detekcja natężenia pola magnetycznego (µT) przy głowie
            </p>
          </div>
        </div>

        <button
          onClick={() => setKey(k => k + 1)}
          disabled={measuring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-800 text-3xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={measuring ? 'animate-spin' : ''} />
          <span>{measuring ? 'Mierzę…' : 'Zmierz'}</span>
        </button>
      </div>

      {/* Main EMF Display */}
      {isHardwareAvailable && total !== null ? (
        <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-black uppercase tracking-wider text-slate-400">
              Natężenie Pola Magnetycznego (Sensor Hardware)
            </span>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-3xs font-black uppercase ${badgeColor}`}>
              <StatusIcon size={12} />
              <span>{status === 'high' ? 'Silne EMF' : status === 'moderate' ? 'Podwyższone' : 'Bezpieczne'}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-black text-white">{val}</span>
            <span className="text-sm font-bold text-purple-400">µT (mikroteśli)</span>
          </div>

          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(10, (val / 200) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-3xs font-bold text-slate-500">
              <span>Pole Ziemi (30–50 µT)</span>
              <span>Próg (90 µT)</span>
              <span>Ładowarki (200+ µT)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={14} /> Brak Fizycznego Czujnika Magnetycznego w Przeglądarce
            </span>
          </div>
          <p className="text-3xs text-slate-300 leading-relaxed font-medium">
            {reading?.errorReason || 'Wymagana jest natywna aplikacja Vanguard Android APK lub przeglądarka z obsługą Web GenericSensor API.'}
          </p>
          <p className="text-3xs text-slate-400 border-t border-white/5 pt-2">
            System Vanguard nie generuje fałszywych odczytów. Aby zmierzyć rzeczywiste pola przy poduszce, użyj aplikacji mobilnej Vanguard APK.
          </p>
        </div>
      )}

      {/* Recommendation Banner */}
      {isHardwareAvailable && reading?.recommendation && (
        <div className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed ${badgeColor}`}>
          {reading.recommendation}
        </div>
      )}

      {/* Bio-hacking Note */}
      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5 text-3xs text-slate-400 leading-normal">
        <div className="flex items-center gap-1.5 font-black uppercase text-purple-300">
          <Zap size={13} /> Zasada Fizyczna: Spadek z Kwadratem Odległości ($1/r^2$)
        </div>
        <p>
          Zasilacze 230V i ładowarki indukcyjne emitują zmienne pole elektromagnetyczne. Jego natężenie spada drastycznie wraz z odległością. Odsunięcie telefonu i ładowarki o 50 cm od głowy redukuje promieniowanie o ponad 90%.
        </p>
      </div>

    </div>
  );
}
