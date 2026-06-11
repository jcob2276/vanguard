export function TrainingAnalysisSection({ trainingAnalysis, analyzeTrainingLoad, isAnalyzingTraining }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-black uppercase tracking-tight text-white">Trener AI</h2>
        <button
          onClick={analyzeTrainingLoad}
          disabled={isAnalyzingTraining}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase text-white/60 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          {isAnalyzingTraining ? 'Analizuję...' : '7 dni vs norma'}
        </button>
      </div>

      {trainingAnalysis && (() => {
        const r = trainingAnalysis;
        const s = r.stats || {};
        const loadColor = r.load_status === 'elevated' ? 'text-orange-400 border-orange-400/30 bg-orange-400/8' : r.load_status === 'optimal' ? 'text-dayC border-dayC/30 bg-dayC/8' : 'text-white/40 border-white/15 bg-white/4';
        const loadLabel = r.load_status === 'elevated' ? 'Przeciążenie' : r.load_status === 'optimal' ? 'Optymalne' : 'Za mało';
        const recovColor = r.recovery_status === 'deficit' ? 'text-dayB border-dayB/30 bg-dayB/8' : r.recovery_status === 'ok' ? 'text-dayC border-dayC/30 bg-dayC/8' : 'text-white/40 border-white/15 bg-white/4';
        const recovLabel = r.recovery_status === 'deficit' ? 'Deficyt' : r.recovery_status === 'ok' ? 'Regeneracja OK' : 'Nadregeneracja';

        const StatRow = ({ label, week, base, unit = '', higherBetter = true }) => {
          if (week == null && base == null) return null;
          const pctVal = (base && base > 0) ? ((week - base) / base * 100) : null;
          const up = pctVal != null && pctVal > 0;
          const neutral = pctVal == null || Math.abs(pctVal) < 3;
          const good = neutral ? null : (higherBetter ? up : !up);
          return (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-20 shrink-0 text-white/35 font-black uppercase text-[8px] tracking-widest">{label}</span>
              <span className="font-black text-white">{week ?? '—'}{unit}</span>
              {pctVal != null && (
                <span className={`text-[9px] font-bold ${good === null ? 'text-white/30' : good ? 'text-dayC' : 'text-dayB'}`}>
                  {pctVal > 0 ? '+' : ''}{pctVal.toFixed(0)}%
                </span>
              )}
              <span className="text-white/20 text-[9px]">norma {base ?? '—'}{unit}</span>
            </div>
          );
        };

        const injuryColor = r.injury_risk?.level === 'high' ? 'border-dayB/30 bg-dayB/8 text-dayB' : r.injury_risk?.level === 'moderate' ? 'border-orange-400/30 bg-orange-400/8 text-orange-400' : 'border-white/[0.07] bg-white/[0.02] text-white/40';

        return (
          <div className="space-y-3">
            {/* Status badges */}
            <div className="flex gap-2 flex-wrap">
              <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${loadColor}`}>{loadLabel}</span>
              <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${recovColor}`}>{recovLabel}</span>
              {r.injury_risk?.level && r.injury_risk.level !== 'low' && (
                <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${injuryColor}`}>
                  {r.injury_risk.level === 'high' ? '⚠ Ryzyko kontuzji' : '△ Uwaga'}
                </span>
              )}
            </div>

            {/* Stats comparison — 7 dni vs średnia 3 poprzednich tygodni */}
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
              {s.km_trend && (
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[8px] font-black uppercase text-white/25 w-20 shrink-0">Km/tydz</span>
                  <div className="flex items-end gap-1 h-6">
                    {s.km_trend.map((v, i) => {
                      const maxV = Math.max(...s.km_trend.filter(Boolean), 1);
                      const h = Math.max(2, Math.round((v / maxV) * 20));
                      return <div key={i} style={{height: h}} className={`w-4 rounded-sm ${i === 3 ? 'bg-primary/70' : 'bg-white/15'}`} title={`${v}km`} />;
                    })}
                  </div>
                  <span className="text-[9px] text-white/40">{s.km_trend?.join(' → ')} km</span>
                </div>
              )}
              <StatRow label="Strain" week={s.week_strain} base={s.base_strain} higherBetter={false} />
              <StatRow label="Readiness" week={s.week_recovery} base={s.base_recovery} />
              <StatRow label="HRV" week={s.week_hrv} base={s.base_hrv} unit="ms" />
              <StatRow label="Sen" week={s.week_sleep} base={s.base_sleep} unit="h" />
              <StatRow label="Siłownia" week={s.week_sets} base={s.base_sets_pw} unit=" ser" />
              <StatRow label="Bieganie" week={s.week_run_km} base={s.base_run_km_pw} unit="km" />
              <StatRow label="Sauna" week={s.week_sauna} base={s.base_sauna_pw} unit="x" />
              {s.hr_max && (
                <p className="text-[9px] text-white/20 pt-1 border-t border-white/[0.04]">HRmax (28d): {s.hr_max} BPM | Z2 &lt; {s.z2_ceiling} BPM</p>
              )}
            </div>

            {/* Summaries */}
            <div className="space-y-1.5">
              {r.load_summary && <p className="text-[11px] text-white/65 leading-relaxed">{r.load_summary}</p>}
              {r.recovery_summary && <p className="text-[11px] text-white/65 leading-relaxed">{r.recovery_summary}</p>}
              {r.training_trajectory && (
                <p className="text-[11px] text-white/50 leading-relaxed italic">{r.training_trajectory}</p>
              )}
              {r.marathon_readiness && (
                <p className="text-[11px] text-primary/70 leading-relaxed border-l-2 border-primary/30 pl-2">{r.marathon_readiness}</p>
              )}
            </div>

            {/* Injury risk */}
            {r.injury_risk && (r.injury_risk.flags?.length > 0 || r.injury_risk.prevention) && (
              <div className={`rounded-lg border p-3 space-y-1.5 ${injuryColor}`}>
                <p className="text-[8px] font-black uppercase tracking-widest opacity-70">Ryzyko kontuzji</p>
                {r.injury_risk.flags?.map((f, i) => (
                  <p key={i} className="text-[10px] leading-snug opacity-80">• {f}</p>
                ))}
                {r.injury_risk.prevention && (
                  <p className="text-[9px] opacity-60 pt-0.5">{r.injury_risk.prevention}</p>
                )}
              </div>
            )}

            {/* Strength prescription */}
            {r.strength_prescription?.exercises?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Następna siłownia</p>
                {r.strength_prescription.focus && (
                  <p className="text-[10px] text-white/45 leading-relaxed">{r.strength_prescription.focus}</p>
                )}
                <div className="space-y-1.5">
                  {r.strength_prescription.exercises.map((ex, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 flex items-start gap-3">
                      <div className="shrink-0 w-5 h-5 rounded bg-primary/15 flex items-center justify-center mt-0.5">
                        <span className="text-[8px] font-black text-primary/70">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black text-white/85">{ex.name}</span>
                          <span className="text-[9px] font-black text-primary/80 bg-primary/10 rounded px-1.5 py-0.5">{ex.sets_reps}</span>
                          {ex.load && <span className="text-[9px] font-black text-white/60 bg-white/5 rounded px-1.5 py-0.5">{ex.load}</span>}
                        </div>
                        {ex.note && <p className="text-[9px] text-white/35 mt-0.5 leading-snug">{ex.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Muscle gaps */}
            {r.missing_muscles?.length > 0 && (
              <div className="rounded-lg border border-orange-400/15 bg-orange-400/5 p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-orange-400/70 mb-1.5">Brakujące partie</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.missing_muscles.map((m, i) => (
                    <span key={i} className="rounded border border-orange-400/25 bg-orange-400/8 px-2 py-0.5 text-[9px] font-bold text-orange-300/80">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Key insights */}
            {r.key_insights?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Wnioski</p>
                {r.key_insights.map((insight, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="shrink-0 text-[8px] font-black text-white/20 mt-0.5">{i + 1}</span>
                    <p className="text-[11px] text-white/60 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Strength + sauna notes */}
            {(r.strength_note || r.sauna_note) && (
              <div className="space-y-1 pt-1 border-t border-white/[0.05]">
                {r.strength_note && <p className="text-[10px] text-white/40">{r.strength_note}</p>}
                {r.sauna_note && <p className="text-[10px] text-white/40">{r.sauna_note}</p>}
              </div>
            )}

            {/* Recommendations */}
            {r.recommendations?.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Rekomendacje</p>
                {r.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-black text-primary/80">{rec.priority}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-white/80">{rec.action}</p>
                      <p className="text-[9px] text-white/35 mt-0.5">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
