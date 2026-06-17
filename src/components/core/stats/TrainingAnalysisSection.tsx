export function TrainingAnalysisSection({ trainingAnalysis, analyzeTrainingLoad, isAnalyzingTraining }: { trainingAnalysis: any; analyzeTrainingLoad: () => void; isAnalyzingTraining: boolean }) {
  return (
    <section className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] font-black tracking-tight text-text-primary">Trener AI</h2>
        <button
          onClick={analyzeTrainingLoad}
          disabled={isAnalyzingTraining}
          className="rounded-xl border border-border-custom bg-surface/50 backdrop-blur-sm px-4.5 py-2 text-[10px] font-black uppercase tracking-wider text-text-secondary transition-all hover:bg-surface hover:text-primary disabled:opacity-40"
        >
          {isAnalyzingTraining ? 'Analizuję...' : '7 dni vs norma'}
        </button>
      </div>

      {trainingAnalysis && (() => {
        const r = trainingAnalysis;
        const s = r.stats || {};
        
        // Dynamic status colors for Light and Dark modes
        const loadColor = r.load_status === 'elevated' 
          ? 'text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10' 
          : r.load_status === 'optimal' 
            ? 'text-dayC border-dayC/25 bg-dayC/5 dark:bg-dayC/10' 
            : 'text-text-secondary border-border-custom bg-surface/40';
        const loadLabel = r.load_status === 'elevated' ? 'Przeciążenie' : r.load_status === 'optimal' ? 'Optymalne' : 'Bodziec niski';

        const recovColor = r.recovery_status === 'deficit' 
          ? 'text-dayB border-dayB/25 bg-dayB/5 dark:bg-dayB/10' 
          : r.recovery_status === 'ok' 
            ? 'text-dayC border-dayC/25 bg-dayC/5 dark:bg-dayC/10' 
            : 'text-text-secondary border-border-custom bg-surface/40';
        const recovLabel = r.recovery_status === 'deficit' ? 'Deficyt' : r.recovery_status === 'ok' ? 'Regeneracja OK' : 'Gotowość wysoka';

        const StatRow = ({ label, week, base, unit = '', higherBetter = true }: { label: string; week: any; base: any; unit?: string; higherBetter?: boolean }) => {
          if (week == null && base == null) return null;
          const pctVal = (base && base > 0) ? ((week - base) / base * 100) : null;
          const fmtNumber = (value: any) => Number.isInteger(Number(value)) ? value : Number(value).toFixed(1);
          const weekText = week == null ? '—' : typeof week === 'number' ? fmtNumber(week) : week;
          const baseText = base == null ? '—' : typeof base === 'number' ? fmtNumber(base) : base;
          const up = pctVal != null && pctVal > 0;
          const neutral = pctVal == null || Math.abs(pctVal) < 3;
          const good = neutral ? null : (higherBetter ? up : !up);
          return (
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="w-20 shrink-0 text-text-muted font-bold uppercase text-[8px] tracking-widest">{label}</span>
              <span className="font-extrabold text-text-primary">{weekText}{unit}</span>
              {pctVal != null && (
                <span className={`text-[9px] font-black ${good === null ? 'text-text-muted' : good ? 'text-dayC' : 'text-dayB'}`}>
                  {pctVal > 0 ? '+' : ''}{pctVal.toFixed(0)}%
                </span>
              )}
              <span className="text-text-muted/60 text-[9.5px] ml-auto">norma {baseText}{unit}</span>
            </div>
          );
        };

        const injuryColor = r.injury_risk?.level === 'high' 
          ? 'border-dayB/30 bg-dayB/5 text-dayB' 
          : r.injury_risk?.level === 'moderate' 
            ? 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400' 
            : 'border-border-custom bg-surface/30 text-text-muted';

        return (
          <div className="space-y-4">
            {/* Status badges */}
            <div className="flex gap-2 flex-wrap">
              <span className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${loadColor}`}>{loadLabel}</span>
              <span className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${recovColor}`}>{recovLabel}</span>
              {r.injury_risk?.level && r.injury_risk.level !== 'low' && (
                <span className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${injuryColor}`}>
                  {r.injury_risk.level === 'high' ? '⚠ Ryzyko kontuzji' : '△ Uwaga'}
                </span>
              )}
            </div>

            {/* Stats comparison — 7 dni vs średnia 3 poprzednich tygodni */}
            <div className="rounded-[24px] border border-border-custom bg-surface/40 backdrop-blur-md p-4.5 space-y-3 shadow-sm">
              {s.km_trend && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[8px] font-black uppercase text-text-muted w-20 shrink-0 tracking-widest">Km/tydz</span>
                  <div className="flex items-end gap-1.5 h-6">
                    {s.km_trend.map((v: any, i: number) => {
                      const maxV = Math.max(...s.km_trend.filter(Boolean), 1);
                      const h = Math.max(2, Math.round((v / maxV) * 20));
                      return <div key={i} style={{height: h}} className={`w-4 rounded-sm ${i === 3 ? 'bg-primary/80 shadow-[0_0_8px_rgba(79,70,229,0.3)]' : 'bg-text-primary/10'}`} title={`${v}km`} />;
                    })}
                  </div>
                  <span className="text-[9px] text-text-secondary ml-auto font-bold">{s.km_trend?.join(' → ')} km</span>
                </div>
              )}
              <div className="space-y-2">
                <StatRow label="Strain" week={s.week_strain} base={s.base_strain} higherBetter={false} />
                <StatRow label="Readiness" week={s.week_recovery} base={s.base_recovery} />
                <StatRow label="HRV" week={s.week_hrv} base={s.base_hrv} unit="ms" />
                <StatRow label="Sen" week={s.week_sleep} base={s.base_sleep} unit="h" />
                <StatRow label="Siłownia" week={s.week_sets} base={s.base_sets_pw} unit=" ser" />
                <StatRow label="Bieganie" week={s.week_run_km} base={s.base_run_km_pw} unit="km" />
                <StatRow label="Sauna" week={s.week_sauna} base={s.base_sauna_pw} unit="x" />
              </div>
              {s.hr_max && (
                <p className="text-[9px] text-text-muted/65 pt-2 border-t border-border-custom font-medium">
                  HRmax (28d): {s.hr_max} BPM | Z2 &lt; {s.z2_ceiling} BPM
                </p>
              )}
            </div>

            {/* Summaries */}
            <div className="space-y-2 rounded-[24px] border border-border-custom bg-surface/30 p-4">
              {r.coach_decision_summary && (
                <p className="text-[11.5px] text-dayC font-semibold leading-relaxed border-l-2 border-dayC/40 pl-2.5 mb-2">{r.coach_decision_summary}</p>
              )}
              {r.load_summary && <p className="text-[11px] text-text-secondary leading-relaxed">{r.load_summary}</p>}
              {r.recovery_summary && <p className="text-[11px] text-text-secondary leading-relaxed">{r.recovery_summary}</p>}
              {r.training_trajectory && (
                <p className="text-[11px] text-text-muted leading-relaxed italic">{r.training_trajectory}</p>
              )}
              {r.marathon_readiness && (
                <p className="text-[11.5px] text-primary font-semibold leading-relaxed border-l-2 border-primary/40 pl-2.5 mt-2">{r.marathon_readiness}</p>
              )}
            </div>

            {/* Injury risk details */}
            {r.injury_risk && ((r.injury_risk.flags?.length ?? 0) > 0 || r.injury_risk.prevention) && (
              <div className={`rounded-[24px] border p-4 space-y-2 ${injuryColor}`}>
                <p className="text-[8px] font-black uppercase tracking-widest opacity-80">Ryzyko kontuzji</p>
                {r.injury_risk.flags?.map((f: any, i: number) => (
                  <p key={i} className="text-[10.5px] leading-snug font-medium opacity-90">• {f}</p>
                ))}
                {r.injury_risk.prevention && (
                  <p className="text-[9.5px] opacity-75 pt-1.5 border-t border-current/10 leading-normal">{r.injury_risk.prevention}</p>
                )}
              </div>
            )}

            {/* Strength prescription */}
            {(r.strength_prescription?.exercises?.length ?? 0) > 0 && (
              <div className="space-y-2.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Następna siłownia</p>
                {r.strength_prescription.focus && (
                  <p className="text-[10px] text-text-secondary leading-relaxed font-semibold">{r.strength_prescription.focus}</p>
                )}
                {r.strength_prescription.critic && (
                  <p className="text-[9.5px] text-amber-600 dark:text-amber-300 leading-relaxed bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 font-medium">{r.strength_prescription.critic}</p>
                )}
                <div className="space-y-2">
                  {r.strength_prescription.exercises.map((ex: any, i: number) => (
                    <div key={i} className="rounded-[16px] border border-border-custom bg-surface/40 px-3.5 py-3 flex items-start gap-3">
                      <div className="shrink-0 w-5 h-5 rounded bg-primary/10 flex items-center justify-center mt-0.5">
                        <span className="text-[9px] font-black text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11.5px] font-bold text-text-primary">{ex.name}</span>
                          <span className="text-[9.5px] font-black text-primary bg-primary/8 rounded-md px-2 py-0.5">{ex.sets_reps}</span>
                          {ex.load && <span className="text-[9.5px] font-black text-text-secondary bg-text-primary/5 rounded-md px-2 py-0.5">{ex.load}</span>}
                        </div>
                        {ex.note && <p className="text-[9.5px] text-text-muted mt-1 leading-snug">{ex.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Muscle gaps */}
            {(r.missing_muscles?.length ?? 0) > 0 && (
              <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Brakujące partie</p>
                <div className="flex flex-wrap gap-2">
                  {r.missing_muscles.map((m: any, i: number) => (
                    <span key={i} className="rounded-lg border border-amber-500/20 bg-surface/80 dark:bg-black/20 px-2.5 py-0.5 text-[9.5px] font-black text-amber-600 dark:text-amber-300 shadow-sm">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Strength + sauna notes */}
            {(r.strength_note || r.sauna_note) && (
              <div className="space-y-1.5 pt-2 border-t border-border-custom">
                {r.strength_note && <p className="text-[10px] text-text-muted font-medium">{r.strength_note}</p>}
                {r.sauna_note && <p className="text-[10px] text-text-muted font-medium">{r.sauna_note}</p>}
              </div>
            )}

            {/* Recommendations */}
            {(r.recommendations?.length ?? 0) > 0 && (
              <div className="space-y-2.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Rekomendacje</p>
                <div className="space-y-2">
                  {r.recommendations.map((rec: any, i: number) => (
                    <div key={i} className="rounded-[24px] border border-border-custom bg-surface/30 p-4 flex gap-3 shadow-sm">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">{rec.priority}</span>
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-black text-text-primary">{rec.action}</p>
                        <p className="text-[9.5px] text-text-muted mt-0.5 leading-normal">{rec.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
