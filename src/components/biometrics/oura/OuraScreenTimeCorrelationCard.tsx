import { Smartphone, ShieldAlert, BarChart2, Flame, Clock, AlertTriangle, Calendar } from 'lucide-react';
import type { OuraHealthHubData } from './types';
import { useScreenTimeCorrelation, type PairedNight } from './hooks/useScreenTimeCorrelation';

function PairedNightsTable({ paired }: { paired: PairedNight[] }) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
      <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-slate-300">
        <Calendar size={13} className="text-indigo-400" />
        Szczegółowy Wykaz Sparowanych Nocy ({paired.length})
      </div>
      <div className="space-y-1.5 text-3xs">
        {paired.map((n) => (
          <div key={n.date} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-300 font-bold">{n.date}</span>
              <span className={`px-2 py-0.5 rounded-md font-bold ${n.lateNightMins >= 30 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                Ekran: {n.lateNightMins} min
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Zasypianie: <strong className="text-white">{n.latencyMins}m</strong></span>
              <span className="text-slate-400">Wynik Oura: <strong className="text-indigo-300">{n.sleepScore} pkt</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OuraScreenTimeCorrelationCard({ ouraHistory }: OuraHealthHubData) {
  const { paired, low, high, dopamine, dopamineNights, scoreDiff, latencyDiff, isLowSample, sampleWarning } = useScreenTimeCorrelation(ouraHistory);
  const hasData = paired.length > 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Smartphone size={16} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-slate-300">
              Korelacja: Czas Ekranowy vs Jakość Snu
            </h4>
            <p className="text-3xs text-slate-400">
              Dane z telefonu (Screen Time) skorelowane z Oura Ring
            </p>
          </div>
        </div>
        <span className="text-3xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
          {paired.length} sparowanych nocy
        </span>
      </div>

      {hasData ? (
        <>
          {/* Low Sample Warning Banner */}
          {isLowSample && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-amber-300">
                <AlertTriangle size={14} /> Mała Próba Statystyczna (N = {paired.length} nocy)
              </div>
              <p className="text-3xs text-slate-300 leading-relaxed font-medium">
                {sampleWarning}
              </p>
            </div>
          )}

          {/* Low vs High Late-Night Screen Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-black uppercase text-emerald-400">Ekran &lt; 30 min nocą</span>
                <span className="text-2xs font-bold text-emerald-300">({low.count} nocy)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{low.avgScore ?? '--'}</span>
                <span className="text-3xs font-bold text-emerald-400">pkt snu Oura</span>
              </div>
              <div className="flex justify-between text-3xs text-slate-300 pt-1 border-t border-emerald-500/20">
                <span>Zasypianie: <strong className="text-white">{low.avgLatency ?? '--'} min</strong></span>
                <span>Głęboki: <strong className="text-white">{low.avgDeep ?? '--'} h</strong></span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-black uppercase text-rose-400">Ekran &gt; 30 min nocą</span>
                <span className="text-2xs font-bold text-rose-300">({high.count} nocy)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{high.avgScore ?? '--'}</span>
                <span className="text-3xs font-bold text-rose-400">pkt snu Oura</span>
              </div>
              <div className="flex justify-between text-3xs text-slate-300 pt-1 border-t border-rose-500/20">
                <span>Zasypianie: <strong className="text-white">{high.avgLatency ?? '--'} min</strong></span>
                <span>Głęboki: <strong className="text-white">{high.avgDeep ?? '--'} h</strong></span>
              </div>
            </div>
          </div>

          {/* Dopamine Loop Section */}
          {dopamineNights.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-amber-400">
                  <Flame size={15} /> Nocna Pętla Dopaminowa (Pinterest / Brave / Social &gt;30m)
                </div>
                <span className="text-3xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">
                  {dopamine.count} nocy
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-3xs text-slate-400 uppercase font-bold">Wynik Snu</span>
                  <p className="text-base font-black text-rose-400">{dopamine.avgScore ?? '--'} pkt</p>
                </div>
                <div>
                  <span className="text-3xs text-slate-400 uppercase font-bold">Zasypianie</span>
                  <p className="text-base font-black text-amber-400">{dopamine.avgLatency ?? '--'} min</p>
                </div>
                <div>
                  <span className="text-3xs text-slate-400 uppercase font-bold">Sen Głęboki</span>
                  <p className="text-base font-black text-slate-200">{dopamine.avgDeep ?? '--'} h</p>
                </div>
              </div>
              <p className="text-3xs text-slate-300 leading-relaxed font-medium">
                Stymulacja układu nagrody po 22:00 hamuje wydzielanie melatoniny i opóźnia przejście układu nerwowego w stan przywspółczulny.
              </p>
            </div>
          )}

          <PairedNightsTable paired={paired} />

          {/* Bio Insight */}
          {(scoreDiff !== null || latencyDiff !== null) && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-indigo-300">
                <ShieldAlert size={14} /> Wniosek Bio-Witalny Oura Engine
              </div>
              <p className="text-xs leading-relaxed text-slate-200 font-medium">
                {isLowSample ? (
                  <>Próba $N={paired.length}$ jest za mała na ostateczny wniosek statystyczny. Gromadźmy dalsze dane z telefonu, aby zweryfikować ubytek fazy głębokiej.</>
                ) : scoreDiff && scoreDiff > 0 ? (
                  <>Używanie telefonu po 22:00 obniża Twój wynik snu o <strong className="text-rose-400">-{scoreDiff} pkt</strong>.</>
                ) : (
                  <>Ekran nocny ma umiarkowane przełożenie na wynik w obecnej próbie.</>
                )}
              </p>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2">
            <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-slate-400">
              <BarChart2 size={13} className="text-indigo-400" />
              Niebieskie Światło & Dopamina Przed Snem
            </div>
            <p className="text-3xs text-slate-400 leading-normal">
              Aplikacje społecznościowe i przeglądarki używane w oknie 22:00–01:00 hamują wydzielanie melatoniny o nawet 50%.
            </p>
          </div>
        </>
      ) : (
        <div className="p-6 text-center rounded-2xl bg-slate-950/40 border border-white/5 space-y-2">
          <Clock size={24} className="mx-auto text-slate-600" />
          <p className="text-xs font-bold text-slate-400">Czekam na synchronizację statystyk czasu ekranowego</p>
          <p className="text-3xs text-slate-500 max-w-sm mx-auto">
            Gdy zsynchronizujesz dane z telefonu (APK lub ActivityWatch), system przeliczy korelacje ze snem Oura.
          </p>
        </div>
      )}

    </div>
  );
}
