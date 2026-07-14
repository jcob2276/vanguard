import { Pressable, ControlInput } from '../../ui/ControlPrimitives';
import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../ui/Card';
import { TrendArrow } from './TrendArrow';
import { computeBmi, effectiveWaistForNavy, navyBodyFatPct } from '../../../lib/health/bodyMetrics';
import { BMI_NORMAL_LOW, BMI_NORMAL_HIGH } from '../../../lib/constants';

interface TrendPoint {
  cur: number | null;
  prev: number | null;
}

export interface NewMetricState {
  weight: string;
  waist: string;
  neck: string;
  chest: string;
  belly: string;
  hips: string;
  thigh: string;
  biceps_l: string;
  calf: string;
}

interface BodyMetricsSectionProps {
  trends: {
    weight?: TrendPoint;
    waist?: TrendPoint;
  };
  newMetric: NewMetricState;
  setNewMetric: (metric: NewMetricState) => void;
  latestBody: {
    weight: number | null;
    waist: number | null;
    neck: number | null;
    body_fat: number | null;
    hips: number | null;
    belly: number | null;
    chest: number | null;
    thigh: number | null;
    biceps_l: number | null;
    calf: number | null;
  } | null;
  heightCm: number | null;
  saveMetrics: (e: React.FormEvent) => void;
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-text-muted font-display block">
        {label}
      </label>
      <ControlInput
        type="number" step="0.1" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '--'}
        className="w-full rounded-xl border border-border-custom bg-surface p-3 text-base font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-focus"
      />
    </div>
  );
}

export function BodyMetricsSection({
  trends, newMetric, setNewMetric, latestBody, heightCm, saveMetrics,
}: BodyMetricsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const set = (key: keyof NewMetricState) => (v: string) => setNewMetric({ ...newMetric, [key]: v });

  // Live calculators — prefer typed value, fall back to latest
  const w = parseFloat(newMetric.weight) || latestBody?.weight || null;
  const waist = parseFloat(newMetric.waist) || latestBody?.waist || null;
  const belly = parseFloat(newMetric.belly) || latestBody?.belly || null;
  const neck = parseFloat(newMetric.neck) || latestBody?.neck || null;
  const hips = parseFloat(newMetric.hips) || latestBody?.hips || null;

  const bmi = w && heightCm ? computeBmi(w, heightCm) : null;
  const whrWaist = waist ?? belly;
  const whr = whrWaist && hips ? Math.round((whrWaist / hips) * 100) / 100 : null;
  const waistNavy = effectiveWaistForNavy({
    waist: parseFloat(newMetric.waist) || latestBody?.waist,
    belly: parseFloat(newMetric.belly) || latestBody?.belly,
  });
  const bf = waistNavy && neck && heightCm ? navyBodyFatPct(waistNavy, neck, heightCm) : null;

  const bfColor = bf == null ? '' : bf < 12 ? 'text-warning' : bf < 18 ? 'text-success dark:text-success' : bf < 25 ? 'text-text-primary' : 'text-danger';
  const bmiColor = bmi == null ? '' : bmi < BMI_NORMAL_LOW ? 'text-warning' : bmi < BMI_NORMAL_HIGH ? 'text-success dark:text-success' : bmi < 30 ? 'text-warning' : 'text-danger';

  return (
    <section className="card !p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[var(--legacy-arbitrary-004)] text-text-muted font-display">
            Pomiary ciała
          </p>
          <h2 className="mt-1 font-display text-lg font-black tracking-tight text-text-primary">
            Waga · talia
          </h2>
        </div>
        <Activity className="text-primary/30 dark:text-primary/45" size={18} />
      </div>

      <div className="space-y-3 px-5 pb-5">
        {/* Main inputs: weight + waist */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-text-muted font-display">
              Waga (kg)
              <TrendArrow current={trends.weight?.cur} previous={trends.weight?.prev} better="down" />
            </label>
            <ControlInput
              type="number" step="0.1" value={newMetric.weight}
              onChange={(e) => setNewMetric({ ...newMetric, weight: e.target.value })}
              className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-focus"
              placeholder={latestBody?.weight ? String(latestBody.weight) : '--'}
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-text-muted font-display">
              Talia (cm)
              <TrendArrow current={trends.waist?.cur} previous={trends.waist?.prev} better="down" />
            </label>
            <ControlInput
              type="number" step="0.1" value={newMetric.waist}
              onChange={(e) => setNewMetric({ ...newMetric, waist: e.target.value })}
              className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-focus"
              placeholder={latestBody?.waist ? String(latestBody.waist) : '--'}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <Pressable
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border-custom bg-surface-solid/60 px-3.5 py-2.5 text-xs font-bold text-text-muted transition-all hover:text-text-primary hover:bg-surface-solid"
        >
          <span>Szczegółowe pomiary · BMI · BF% · WHR</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Pressable>

        {/* Expandable panel */}
        {expanded && (
          <Card className="space-y-4">
            {/* Live indicators */}
            {(bmi != null || bf != null || whr != null) && (
              <div className="flex flex-wrap gap-2 pb-1">
                {bmi != null && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border border-border-custom bg-surface px-3 py-1 text-xs font-black ${bmiColor}`}>
                    BMI <span>{bmi}</span>
                  </span>
                )}
                {bf != null && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border border-border-custom bg-surface px-3 py-1 text-xs font-black ${bfColor}`}>
                    BF% <span>{bf}%</span>
                    <span className="text-2xs font-normal text-text-muted">Navy</span>
                  </span>
                )}
                {whr != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border-custom bg-surface px-3 py-1 text-xs font-black text-text-primary">
                    WHR <span>{whr}</span>
                  </span>
                )}
                {bf == null && latestBody?.body_fat != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border-custom bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                    ostatni BF {latestBody.body_fat}%
                  </span>
                )}
              </div>
            )}

            {/* Circumference inputs */}
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Szyja (cm)"        value={newMetric.neck}     onChange={set('neck')}     placeholder={latestBody?.neck    ? String(latestBody.neck)    : '~37'} />
              <Field label="Klatka (cm)"        value={newMetric.chest}    onChange={set('chest')}    placeholder={latestBody?.chest   ? String(latestBody.chest)   : '--'} />
              <Field label="Brzuch (cm)"        value={newMetric.belly}    onChange={set('belly')}    placeholder={latestBody?.belly   ? String(latestBody.belly)   : '--'} />
              <Field label="Biodra (cm)"        value={newMetric.hips}     onChange={set('hips')}     placeholder={latestBody?.hips    ? String(latestBody.hips)    : '--'} />
              <Field label="Udo (cm)"           value={newMetric.thigh}    onChange={set('thigh')}    placeholder={latestBody?.thigh   ? String(latestBody.thigh)   : '--'} />
              <Field label="Biceps L (cm)"      value={newMetric.biceps_l} onChange={set('biceps_l')} placeholder={latestBody?.biceps_l ? String(latestBody.biceps_l) : '--'} />
            </div>

            <p className="text-2xs text-text-muted leading-relaxed">
              Mierz rano, na czczo, na rozluźnionych mięśniach. Talia = najwęższe miejsce tułowia.
              Brzuch = na poziomie pępka. Biodra = najszerszy punkt pośladków.
              BF% obliczany metodą US Navy (brzuch/talia − szyja → log₁₀).
            </p>
          </Card>
        )}

        <Pressable
          variant="primary"
          onClick={saveMetrics}
          className="w-full"
        >
          Zapisz pomiary
        </Pressable>
      </div>
    </section>
  );
}
