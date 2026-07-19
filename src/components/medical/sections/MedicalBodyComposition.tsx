import { useState } from 'react';
import { Card } from '../../ui/Card';
import { Activity, Scale, Info, Calendar } from 'lucide-react';
import type { BodyCompositionRow } from '../../../lib/health/medicalAnalytics';

interface MedicalBodyCompositionProps {
  rows: BodyCompositionRow[];
}

export default function MedicalBodyComposition({ rows }: MedicalBodyCompositionProps) {
  const latest = rows[0];

  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-border-custom py-12 text-center">
        <p className="text-xs text-text-muted italic">Brak zarejestrowanych pomiarów składu ciała.</p>
      </div>
    );
  }

  // Calculate trends/averages if multiple points exist
  const avgFat = rows.length > 0 
    ? rows.reduce((acc, curr) => acc + (curr.body_fat_pct || 0), 0) / rows.length
    : 0;

  const avgMuscle = rows.length > 0 
    ? rows.reduce((acc, curr) => acc + (curr.muscle_mass_kg || 0), 0) / rows.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display flex items-center gap-2">
          <Scale size={18} className="text-primary shrink-0" /> Pomiary Ciała
        </h2>
        <p className="text-2xs text-text-muted mt-0.5">Analiza impedancji bioelektrycznej (BIA) i wagi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest raw weight card */}
        <Card variant="surface" padding="1.25rem" className="flex flex-col justify-between h-40">
          <div>
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Ostatnia Waga</span>
            <p className="text-3xl font-black text-text-primary mt-2">
              {latest.weight_kg ? `${latest.weight_kg.toFixed(1)} kg` : '—'}
            </p>
          </div>
          <div className="flex items-center justify-between text-3xs text-text-secondary border-t border-border-custom/40 pt-2.5">
            <span className="flex items-center gap-1 font-bold">
              <Calendar size={10} /> {latest.measured_at?.slice(0, 10)}
            </span>
            <span className="font-bold uppercase bg-border-custom px-1.5 py-0.5 rounded">
              Wiarygodność: {latest.reliability || 'Średnia'}
            </span>
          </div>
        </Card>

        {/* Device estimations */}
        <Card variant="surface" padding="1.25rem" className="flex flex-col justify-between h-40">
          <div>
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Estymacje Urządzenia (BIA)</span>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-2xs text-text-muted uppercase font-bold">Tkanka Tłuszczowa</p>
                <p className="text-sm font-black text-text-primary mt-0.5">
                  {latest.body_fat_pct ? `${latest.body_fat_pct.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-muted uppercase font-bold">Masa Mięśniowa</p>
                <p className="text-sm font-black text-text-primary mt-0.5">
                  {latest.muscle_mass_kg ? `${latest.muscle_mass_kg.toFixed(1)} kg` : '—'}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-text-muted italic border-t border-border-custom/40 pt-2">
            Średnie: tłuszcz {avgFat.toFixed(1)}% · mięśnie {avgMuscle.toFixed(1)} kg
          </p>
        </Card>

        {/* Hydration / measurement conditions contexts */}
        <Card variant="surface" padding="1.25rem" className="flex flex-col justify-between h-40">
          <div>
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Metoda i Warunki Pomiary</span>
            <div className="space-y-1 mt-2 text-xs font-bold text-text-secondary">
              <p>
                <span className="text-text-muted font-semibold uppercase text-3xs">Metoda:</span> {latest.method || 'Tanita / BIA'}
              </p>
              <p>
                <span className="text-text-muted font-semibold uppercase text-3xs">Źródło:</span> {latest.source || 'Waga inteligentna'}
              </p>
            </div>
          </div>
          {latest.notes && (
            <div className="rounded-lg border border-primary/10 bg-primary/[0.01] p-1.5 flex gap-1.5 items-start mt-2">
              <Info size={10} className="text-primary shrink-0 mt-0.5" />
              <p className="text-3xs text-text-muted leading-snug truncate" title={latest.notes}>
                Kontekst: {latest.notes}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
