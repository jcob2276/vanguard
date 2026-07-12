import { useMemo } from 'react';
import { Panel } from '../shell/Panel';
import { getTodayWarsaw } from '../../../lib/date';
import { type BodyRow } from '@vanguard/domain';
import { Activity } from 'lucide-react';
import { computeFitnessProfile } from './fitnessScoreUtils';
import FitnessRadarChart from './FitnessRadarChart';
import type { OuraRow, NutritionDayRow } from '../desktopUtils';
import type { DesktopSessionRow, StravaActivityRow, HabitRow, HabitLogRow } from '../shell/useDesktopData';

interface FitnessScorePanelProps {
  oura: OuraRow[];
  nutrition: NutritionDayRow[];
  sessions: DesktopSessionRow[];
  strava: StravaActivityRow[];
  habits: HabitRow[];
  habitLogs: HabitLogRow[];
  volData: { week: string; vol: number }[];
  body: BodyRow[];
  heightCm: number | null;
  theme: string;
  grid: string;
}

export default function FitnessScorePanel({
  oura, nutrition, sessions, strava, habits, habitLogs,
  volData, body, heightCm, theme, grid,
}: FitnessScorePanelProps) {
  const today = getTodayWarsaw();
  const profile = useMemo(
    () => computeFitnessProfile({ oura, nutrition, sessions, strava, habits, habitLogs, volData, body, heightCm, today }),
    [oura, nutrition, sessions, strava, habits, habitLogs, volData, body, heightCm, today],
  );

  return (
    <Panel title="Hybrydowy Profil & Fitness Score" className="h-full flex flex-col">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-center flex-1">
        <div className="flex flex-col items-center justify-center py-4 xl:py-8 xl:min-h-[280px] border-b xl:border-b-0 xl:border-r border-border-custom">
          <div className="flex items-center gap-1.5 mb-3 text-primary">
            <Activity size={16} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
              Hybrydowy profil
            </span>
          </div>
          <div className="flex items-stretch gap-6">
            <div className="flex flex-col items-center">
              <p className="text-[56px] xl:text-[64px] font-black italic tracking-tighter leading-none text-primary font-display">
                {profile.capabilityScore}
              </p>
              <p className="text-[9px] font-bold text-text-muted mt-2 uppercase tracking-widest text-center">
                Capability /100
              </p>
            </div>
            <div className="w-px bg-border-custom" />
            <div className="flex flex-col items-center">
              <p className="text-[56px] xl:text-[64px] font-black italic tracking-tighter leading-none text-text-primary font-display">
                {profile.processScore}
              </p>
              <p className="text-[9px] font-bold text-text-muted mt-2 uppercase tracking-widest text-center">
                Process /100
              </p>
            </div>
          </div>
          <p className="text-[11px] text-text-secondary mt-5 max-w-[280px] text-center leading-relaxed">
            Capability = siła + wydolność (realna zdolność). Process = regularność + regeneracja + adaptacja + obciążenie (dyscyplina, nie zdolność) — liczone osobno, żeby jedno nie maskowało drugiego.
          </p>
        </div>

        <FitnessRadarChart profile={profile} theme={theme} grid={grid} />
      </div>

      <div className="mt-5 pt-5 border-t border-border-custom">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-3">
          Skąd te oceny?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profile.breakdowns.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-border-custom/80 bg-surface-solid/30 px-3.5 py-3"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-[11px] font-black text-text-primary">{item.label}</span>
                <span
                  className={`text-[12px] font-black italic font-display shrink-0 ${
                    item.group === 'capability' ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  {item.score.toFixed(1)}/10
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-text-secondary">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
          Niebieskie wyniki (Wydolność, Siła) wchodzą do Capability. Szare (Regularność, Regeneracja, Adaptacja, Obciążenie) wchodzą do Process. Siła i wydolność łączą ostatnią pracę z maxami (wycisk / przysiad / martwy, Cooper) względem masy ciała — PR starsze niż ~3 lata wypadają. Regeneracja uwzględnia BMI, WHR i BF%.
        </p>
      </div>
    </Panel>
  );
}
