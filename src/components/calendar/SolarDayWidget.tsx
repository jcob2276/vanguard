import { useSolarData } from './hooks/useSolarData';
import { Card } from '../ui/Card';

interface Props {
  dateStr: string; // YYYY-MM-DD
}

/**
 * SolarDayWidget — widget sidebara kalendarza pokazujący:
 * - Wschód / zachód słońca (godziny)
 * - Fazę księżyca (emoji + nazwa)
 * - Gradient wizualizujący długość dnia
 */
export default function SolarDayWidget({ dateStr }: Props) {
  const { sunriseStr, sunsetStr, moon, sunTimes, dayProgressPct } = useSolarData(dateStr);

  // Długość dnia w godzinach i minutach
  const dayLenMin = sunTimes.sunsetMin - sunTimes.sunriseMin;
  const dayLenH = Math.floor(dayLenMin / 60);
  const dayLenM = dayLenMin % 60;

  // Procent dnia świetlnego: gdzie na pasku jest wschód i zachód
  // Oś: 0 = 00:00, 1440 min = 24:00
  const sunrisePct = (sunTimes.sunriseMin / 1440) * 100;
  const sunsetPct = (sunTimes.sunsetMin / 1440) * 100;

  return (
    <Card variant="surface" padding="0.75rem" className="space-y-2.5 select-none">
      {/* Wschód / Zachód */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-lg" title="Wschód słońca">🌅</span>
          <div>
            <div className="text-sm font-bold text-text-primary tabular-nums">{sunriseStr}</div>
            <div className="text-2xs text-text-muted uppercase tracking-wider">Wschód</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-bold text-text-muted tabular-nums">
            {dayLenH}h {dayLenM}m
          </div>
          <div className="text-2xs text-text-muted/60 uppercase tracking-wider">światła</div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="text-right">
            <div className="text-sm font-bold text-text-primary tabular-nums">{sunsetStr}</div>
            <div className="text-2xs text-text-muted uppercase tracking-wider">Zachód</div>
          </div>
          <span className="text-lg" title="Zachód słońca">🌇</span>
        </div>
      </div>

      {/* Pasek wizualizacji dnia */}
      <div className="relative h-[var(--ds-h-6px)] rounded-full overflow-hidden bg-scrim/10 dark:bg-on-accent/8">
        {/* Noc — lewa */}
        <div
          className="absolute inset-y-0 left-0 bg-primary/60 dark:bg-primary/50"
          style={{ width: `${sunrisePct}%` }}
        />
        {/* Dzień — środek */}
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-warning/80 via-warning/90 to-warning/80"
          style={{ left: `${sunrisePct}%`, width: `${sunsetPct - sunrisePct}%` }}
        />
        {/* Noc — prawa */}
        <div
          className="absolute inset-y-0 right-0 bg-primary/60 dark:bg-primary/50"
          style={{ width: `${100 - sunsetPct}%` }}
        />
        {/* Kursor "teraz" — tylko dla dzisiaj */}
        {dayProgressPct > 0 && dayProgressPct < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[var(--ds-w-3px)] h-[var(--ds-h-10px)] rounded-full bg-on-accent shadow-sm shadow-warning/80 z-[var(--z-raised)]"
            style={{
              left: `calc(${sunrisePct + (dayProgressPct / 100) * (sunsetPct - sunrisePct)}% - 1.5px)`,
            }}
          />
        )}
      </div>

      {/* Faza księżyca */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-xl leading-none">{moon.emoji}</span>
        <div>
          <div className="text-xs font-semibold text-text-primary">{moon.name}</div>
          <div className="text-2xs text-text-muted uppercase tracking-wider">
            {Math.round(moon.phase * 100)}% cyklu
          </div>
        </div>
      </div>
    </Card>
  );
}
