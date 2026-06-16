export interface StrainData {
  daily_status: string | null;
  main_limiter: string | null;
  strain_score: number | null;
  recovery_score: number | null;
  fueling_score: number | null;
  fueling_provisional: boolean;
}

export interface OuraData {
  date: string;
  readiness_score: number | null;
  hrv_avg: number | null;
  total_sleep_hours: number | null;
}

interface CockpitBannerProps {
  strain: StrainData | null;
  oura: OuraData[];
}

const LIMITER_PL: Record<string, string> = {
  sleep: 'sen',
  calories: 'kalorie',
  carbs: 'węgle',
  cardio_load: 'cardio',
  strength_load: 'siłownia',
  mental_load: 'głowa',
  recovery_ok: 'OK'
};

function cockpitDecision(status: string, limiter: string | null, strain: number | null, provisional: boolean) {
  const fuelLimiter = limiter === 'calories' || limiter === 'carbs';
  if (status === 'green') return 'Możesz cisnąć — wszystko na zielono';
  if (status === 'red') {
    if (limiter === 'sleep') return 'Zadedykuj czas na sen i odpoczynek';
    if (fuelLimiter && !provisional) return 'Uzupełnij energię — niski bilans';
    return 'Ładowanie baterii / Regeneracja';
  }
  if (limiter === 'sleep') return 'Umiarkowanie — sen poniżej normy';
  if (fuelLimiter && !provisional) return 'Umiarkowanie — dobierz kalorie';
  if (limiter === 'cardio_load' || limiter === 'strength_load') return 'Umiarkowanie — wczoraj duży koszt';
  return (strain || 0) < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj';
}

export default function CockpitBanner({ strain, oura }: CockpitBannerProps) {
  const latest = oura[oura.length - 1];
  if (!strain && !latest) return null;

  const status = strain?.daily_status || 'unknown';
  const cfg = {
    green:  { bg: 'bg-emerald-500/[0.05] border-emerald-500/25', dot: 'bg-emerald-500', pulse: 'bg-emerald-400', tag: 'ZIELONY' },
    yellow: { bg: 'bg-amber-500/[0.05] border-amber-500/25',     dot: 'bg-amber-400',   pulse: 'bg-amber-300',   tag: 'ŻÓŁTY' },
    red:    { bg: 'bg-rose-500/[0.05] border-rose-500/25',       dot: 'bg-rose-500',     pulse: 'bg-rose-400',    tag: 'CZERWONY' },
  }[status] || { bg: 'bg-surface border-border-custom', dot: 'bg-text-muted', pulse: 'bg-text-muted', tag: '—' };

  const msg = strain ? cockpitDecision(status, strain.main_limiter, strain.strain_score, strain.fueling_provisional) : '—';
  const limiter = strain?.main_limiter && strain.main_limiter !== 'recovery_ok' ? LIMITER_PL[strain.main_limiter] : null;
  const readColor = !latest?.readiness_score ? 'text-text-muted' : latest.readiness_score >= 70 ? 'text-emerald-500' : latest.readiness_score >= 50 ? 'text-amber-500' : 'text-rose-500';
  const ouraAge = latest?.date ? Math.floor((Date.now() - new Date(latest.date + 'T12:00:00').getTime()) / 86400000) : null;

  return (
    <div className={`rounded-[24px] border ${cfg.bg} px-8 py-6 flex items-center justify-between gap-8`}>
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div className={`absolute w-3 h-3 rounded-full ${cfg.pulse} opacity-40 animate-ping`} />
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted">{cfg.tag} — COCKPIT</span>
        </div>
        <p className="font-display text-[32px] font-black leading-tight text-text-primary">{msg}</p>
        {limiter && <p className="text-[11px] text-text-secondary mt-1.5">Limiter: <span className="font-black">{limiter}</span></p>}
        {ouraAge !== null && ouraAge > 0 && (
          <p className="text-[8px] text-text-muted/60 mt-2">● Oura: {ouraAge === 1 ? 'wczoraj' : `${ouraAge} dni temu`}</p>
        )}
      </div>
      <div className="flex gap-6 shrink-0">
        {[
          { label: 'Readiness', val: latest?.readiness_score, unit: '/100', color: readColor },
          { label: 'HRV',       val: latest?.hrv_avg,          unit: 'ms' },
          { label: 'Sen',       val: latest?.total_sleep_hours ? +latest.total_sleep_hours.toFixed(1) : null, unit: 'h' },
          { label: 'Recovery',  val: strain?.recovery_score,   unit: '/100' },
          { label: 'Fueling',   val: strain?.fueling_score,    unit: '/100' },
        ].map(({ label, val, unit, color }) => (
          <div key={label} className="text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-1">{label}</p>
            <p className={`font-display text-[22px] font-black leading-none ${color || 'text-text-primary'}`}>
              {val ?? '—'}<span className="text-[10px] text-text-muted font-semibold ml-0.5">{unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
