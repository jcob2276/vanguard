import React from 'react';
import { parseISO, differenceInDays } from 'date-fns';
import { STATUS_CFG, SENSE_CFG, LIFE_PILLARS, weekStartDate } from './desktopUtils';
import { Panel } from './Panel';

export interface ProjectsSectionProps {
  goals: any;
  projects: any[];
  moves: any[];
}

export default function ProjectsSection({ goals, projects, moves }: ProjectsSectionProps) {
  const projMap = Object.fromEntries((projects || []).map((p: any) => [p.id, p]));
  const activeProj = (projects || []).filter((p: any) => p.sense_status !== 'cut' && p.sense_status !== 'completed');
  const ws = weekStartDate();
  const doneWeek = (moves || []).filter((m: any) => m.status === 'done' && (m.completed_at || '').slice(0, 10) >= ws);
  const inProgress = (moves || []).filter((m: any) => m.status === 'doing');
  const blocked = (moves || []).filter((m: any) => m.status === 'blocked');

  const feedMoves = [
    ...inProgress,
    ...blocked,
    ...(moves || []).filter((m: any) => m.status === 'done').slice(0, 8)
  ].slice(0, 14);

  return (
    <Panel title="Projekty & Cele">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Aktywne projekty', val: activeProj.length, color: 'text-text-primary' },
          { label: 'Done ten tydzień', val: doneWeek.length, color: 'text-emerald-500' },
          { label: 'W toku', val: inProgress.length, color: 'text-sky-500' },
          { label: 'Zablokowane', val: blocked.length, color: blocked.length > 0 ? 'text-rose-500' : 'text-text-muted' }
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-[14px] border border-border-custom bg-surface-solid px-4 py-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted mb-1">{label}</p>
            <p className={`font-display text-[28px] font-black leading-none ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Left: projects + moves feed */}
        <div className="space-y-5">
          {activeProj.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-2.5">
                Projekty ({activeProj.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {activeProj.slice(0, 6).map((p: any) => {
                  const sense = SENSE_CFG[p.sense_status] || SENSE_CFG.unsure;
                  return (
                    <div
                      key={p.id}
                      className="rounded-[12px] border border-border-custom bg-surface-solid px-3.5 py-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-text-primary truncate leading-tight">{p.name}</p>
                        {p.area && <p className="text-[9px] text-text-muted mt-0.5">{p.area}</p>}
                      </div>
                      <span
                        className={`shrink-0 text-[7px] font-black uppercase tracking-wider border rounded-md px-1.5 py-0.5 ${sense.cls}`}
                      >
                        {sense.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {feedMoves.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-2.5">
                Zadania projektowe
              </p>
              <div className="divide-y divide-border-custom/40">
                {feedMoves.map((m: any) => {
                  const cfg = STATUS_CFG[m.status] || STATUS_CFG.todo;
                  const proj = projMap[m.project_id];
                  const dateStr = m.completed_at
                    ? new Date(m.completed_at).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'Europe/Warsaw'
                      })
                    : m.planned_for
                    ? `plan: ${new Date(m.planned_for + 'T12:00:00').toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'Europe/Warsaw'
                      })}`
                    : null;
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <p className="text-[12px] font-semibold text-text-primary flex-1 truncate">{m.title}</p>
                      {proj && (
                        <span className="text-[9px] text-text-muted shrink-0 hidden xl:block truncate max-w-[130px]">
                          {proj.name}
                        </span>
                      )}
                      {dateStr && <span className="text-[9px] text-text-muted shrink-0 whitespace-nowrap">{dateStr}</span>}
                      <span
                        className={`shrink-0 text-[7px] font-black uppercase tracking-wider border rounded-md px-1.5 py-0.5 ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!activeProj.length && !feedMoves.length && (
            <p className="text-[11px] text-text-muted py-6 text-center">Brak projektów — dodaj je w sekcji Projekty</p>
          )}
        </div>

        {/* Right: life goals */}
        {goals && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-3">Kierunki życia</p>
            <div className="space-y-3">
              {LIFE_PILLARS.map(({ key, dateKey, label, color, borderBg, Icon }) => {
                const text = goals[key];
                const days = goals[dateKey] ? differenceInDays(parseISO(goals[dateKey]), new Date()) : null;
                if (!text) return null;
                return (
                  <div key={key} className={`rounded-[16px] border ${borderBg} px-4 py-3.5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={12} className={`${color} shrink-0`} />
                      <span className={`text-[8px] font-black uppercase tracking-wider ${color}`}>{label}</span>
                      {days !== null && (
                        <span
                          className={`ml-auto text-[9px] font-black rounded-lg px-2 py-0.5 border ${
                            days <= 30
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                              : 'border-border-custom text-text-muted'
                          }`}
                        >
                          {days}d
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-text-primary leading-snug">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
