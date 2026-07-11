import type { useNutritionData } from '../useNutritionData';

type NutritionData = ReturnType<typeof useNutritionData>;

interface NutritionForecastPanelProps {
  forecast: NutritionData['forecast'];
  forecastNote: NutritionData['forecastNote'];
}

export default function NutritionForecastPanel({ forecast, forecastNote }: NutritionForecastPanelProps) {
  if (!forecast || (forecast.forecast_30d_weight_kg == null && !forecast.adaptive_correction_kcal)) {
    return null;
  }

  return (
    <div className="mt-3.5 rounded-xl border border-border-custom/50 bg-surface-solid/15 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">Prognoza przy obecnym tempie</p>
      {forecast.forecast_30d_weight_kg != null && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {([
            ['30d', forecast.forecast_30d_weight_kg, forecast.forecast_30d_bf_pct],
            ['60d', forecast.forecast_60d_weight_kg, forecast.forecast_60d_bf_pct],
            ['90d', forecast.forecast_90d_weight_kg, forecast.forecast_90d_bf_pct],
          ] as const).map(([label, w, bf]) => (
            <div key={label} className="rounded-lg border border-border-custom/40 bg-surface-solid/30 px-2 py-1.5 text-center">
              <p className="text-[8px] font-black uppercase text-text-muted">{label}</p>
              <p className="text-[12px] font-black text-text-primary">{w != null ? `${w}kg` : '—'}</p>
              {bf != null && <p className="text-[9px] font-bold text-text-muted">{bf}% BF</p>}
            </div>
          ))}
        </div>
      )}
      {forecast.days_to_goal_est != null && (
        <p className="text-[10.5px] text-text-secondary mb-1">
          Przy tym tempie cel BF za <strong className="text-text-primary">~{forecast.days_to_goal_est} dni</strong>
        </p>
      )}
      {!!forecast.adaptive_correction_kcal && (
        <p className="text-[10.5px] text-text-secondary mb-1">
          🔧 Adaptive correction: <strong className={forecast.adaptive_correction_kcal > 0 ? 'text-rose-400' : 'text-emerald-400'}>
            {forecast.adaptive_correction_kcal > 0 ? '-' : '+'}{Math.abs(forecast.adaptive_correction_kcal)} kcal/dzień
          </strong> (tempo vs plan)
        </p>
      )}
      {forecastNote && <p className="text-[10.5px] text-text-secondary leading-snug mt-1">{forecastNote}</p>}
    </div>
  );
}
