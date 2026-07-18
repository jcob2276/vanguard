import { ShieldCheck } from 'lucide-react';
import { Card } from '../../ui/Card';
import type { NutritionDayAudit } from '../../../lib/health/nutritionAudit';
import type { NutritionCalibration } from '../../../lib/health/nutritionCalibration';

export default function NutritionTrustPanel({ audit, calibration }: {
  audit: NutritionDayAudit;
  calibration: NutritionCalibration;
}) {
  return (
    <Card variant="outline" padding="0.75rem" className="mt-3.5 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-wider text-text-muted">
          <ShieldCheck size={13} /> Wiarygodność dnia
        </p>
        <span className={`text-xs font-black ${audit.score >= 90 ? 'text-success' : audit.score >= 70 ? 'text-warning' : 'text-danger'}`}>
          {audit.label === 'Brak wpisów' ? '—' : `${audit.score}%`}
        </span>
      </div>
      <p className="text-xs text-text-secondary">
        {audit.label}{audit.uncertainEntries ? ` · ${audit.uncertainEntries} ${audit.uncertainEntries === 1 ? 'szacunek' : 'szacunki'}` : ''}
      </p>
      <p className="border-t border-border-custom/40 pt-2 text-xs text-text-muted">{calibration.message}</p>
    </Card>
  );
}
