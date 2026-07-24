/**
 * @component OuraBioExperimentsCard
 * @role Laboratorium Eksperymentów Bio-Hakerskich & Testy Procesów XYZ.
 *       Umożliwia uruchamianie i śledzenie testów A/B wpływu suplementów, Sauny, pory posiłków i nawyków na regenerację Oura.
 */
import { useState } from 'react';
import { Sparkles, FlaskConical, TestTube, CheckCircle2, Play, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { OuraHealthHubData } from './types';

interface BioExperiment {
  id: string;
  name: string;
  category: 'Suplementacja' | 'Regeneracja' | 'Rytm Dobowy' | 'Trening';
  protocol: string;
  targetMetric: string;
  durationDays: number;
  status: 'active' | 'suggested' | 'completed';
  expectedImpact: string;
}

export function OuraBioExperimentsCard({ enhanced, oura }: OuraHealthHubData) {
  const [activeTab, setActiveTab] = useState<'experiments' | 'suggested'>('suggested');

  const experiments: BioExperiment[] = [
    {
      id: 'exp-1',
      name: 'Protokół Glicyny (3g) + Magnezu Treonianu (200mg)',
      category: 'Suplementacja',
      protocol: 'Przyjmij 3g Glicyny i 200mg Treonianu Magnezu na 45 min przed pójściem do łóżka.',
      targetMetric: 'Wydłużenie Fazy REM & Głęboki Sen (+15%)',
      durationDays: 7,
      status: 'suggested',
      expectedImpact: 'Obniżenie centralnej temperatury ciała w nocy i szybsza atonia mięśniowa.',
    },
    {
      id: 'exp-2',
      name: 'Przesunięcie Cut-offu Kofeiny na 12:30',
      category: 'Rytm Dobowy',
      protocol: 'Ostatni kubek kawy/kofeiny o 12:30. Po 12:30 wyłącznie woda i zioła.',
      targetMetric: 'Skrócenie Latencji Zasypiania do < 12 min',
      durationDays: 14,
      status: 'suggested',
      expectedImpact: 'Spadek poziomu blokady receptorów adenozynowych przed 22:30.',
    },
    {
      id: 'exp-3',
      name: 'Protokół Sauny po Treningu Siłowym (20 min @ 85°C)',
      category: 'Regeneracja',
      protocol: '20 minut sauny suchej po treningu siłowym, następnie 2 minuty chłodnego prysznica.',
      targetMetric: 'Wzrost Nocnego HRV (+12 ms) & Somatotropiny',
      durationDays: 7,
      status: 'suggested',
      expectedImpact: 'Wyrzut białek szoku cieplnego (HSP) i głęboki wyż przywspółczulny.',
    },
  ];

  return (
    <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/40 p-5 space-y-4 shadow-2xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
            <TestTube size={18} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-purple-300 flex items-center gap-1">
              LABORATORIUM EKSPERYMENTÓW PROCESÓW XYZ <Sparkles size={12} className="text-amber-400 animate-pulse" />
            </h4>
            <p className="text-xs font-bold text-white">Testy A/B Bio-Hakingu, Suplementów & Regeneracji</p>
          </div>
        </div>

        <span className="text-3xs font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck size={12} /> Testy A/B Oura
        </span>
      </div>

      {/* Suggested Experiments List */}
      <div className="space-y-3">
        <h5 className="text-3xs font-black uppercase tracking-wider text-slate-400">
          Proponowane Protokóły i Eksperymenty na Baza Twoich 220 Nocy:
        </h5>

        <div className="space-y-2.5">
          {experiments.map((exp) => (
            <div key={exp.id} className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-black uppercase tracking-wider text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
                  {exp.category} · Test {exp.durationDays} dni
                </span>
                <span className="text-3xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Cel: {exp.targetMetric}
                </span>
              </div>

              <div className="space-y-1">
                <h6 className="text-xs font-black text-white">{exp.name}</h6>
                <p className="text-3xs text-slate-300 leading-relaxed font-medium">{exp.protocol}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-2 text-3xs">
                <span className="text-slate-400 font-medium italic">Oczekiwany efekt: {exp.expectedImpact}</span>
                <button
                  onClick={() => alert(`Uruchomiono eksperyment: ${exp.name}. System Oura będzie śledził Twoją biometrię przez ${exp.durationDays} dni.`)}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-extrabold text-[10px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Play size={10} /> Rozpocznij Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
