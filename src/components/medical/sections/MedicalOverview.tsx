import { Calendar, HelpCircle, AlertOctagon, CheckSquare, ArrowRight } from 'lucide-react';
import type { MedicalLabRow } from '../../../lib/health/medicalAnalytics';
import { Card } from '../../ui/Card';

interface MedicalOverviewProps {
  labs: MedicalLabRow[];
  documents: any[];
  onActionClick: (actionId: string) => void;
}

export default function MedicalOverview({ labs, documents, onActionClick }: MedicalOverviewProps) {
  const latestPanel = labs.length > 0 ? labs[0] : null;
  const latestDateStr = latestPanel ? latestPanel.result_date : null;
  
  // Calculate stats
  const outOfRangeCount = labs.filter(l => l.flag && l.flag !== 'N' && l.flag !== 'normal').length;
  
  // Panel completeness logic (e.g. check if basic markers exist)
  const requiredBasicKeys = ['hemoglobin', 'wbc', 'rbc', 'plt', 'ferritin', 'tsh', 'glucose'];
  const userKeys = new Set(labs.map(l => l.marker_key));
  const missingKeys = requiredBasicKeys.filter(k => !userKeys.has(k));
  const completeness = missingKeys.length === 0 ? 'Kompletna' : missingKeys.length <= 2 ? 'Średnia' : 'Niska';

  return (
    <div className="space-y-6">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display">1. Przegląd Stanu Zdrowia</h2>
        <p className="text-2xs text-text-muted mt-0.5">Podstawowy stan dokumentów, kompletności i pilnych spraw</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Freshness Card */}
        <Card variant="outline" padding="1rem" className="flex flex-col justify-between h-36 bg-background/30">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <Calendar size={12} className="text-primary" />
              Aktualność paneli
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              {latestDateStr ? `Ostatni panel: ${latestDateStr}` : 'Brak danych'}
            </p>
          </div>
          <p className="text-3xs text-text-muted">Optymalna częstotliwość badania: co 6 miesięcy</p>
        </Card>

        {/* Completeness Card */}
        <Card variant="outline" padding="1rem" className="flex flex-col justify-between h-36 bg-background/30">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <HelpCircle size={12} className="text-primary" />
              Kompletność danych
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              Poziom: {completeness}
            </p>
          </div>
          <p className="text-3xs text-text-muted">
            {missingKeys.length > 0 ? `Brakuje kluczowych markerów: ${missingKeys.length}` : 'Wszystkie bazowe markery obecne'}
          </p>
        </Card>

        {/* Out of Range Card */}
        <Card variant="outline" padding="1rem" className="flex flex-col justify-between h-36 bg-background/30">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <AlertOctagon size={12} className="text-warning" />
              Odchylenia laboratoryjne
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              {outOfRangeCount} wyniki poza normą
            </p>
          </div>
          <p className="text-3xs text-text-muted">Sprawdź wyniki oznaczone flagą ostrzegawczą</p>
        </Card>

        {/* Next Step / Action Card */}
        <button
          onClick={() => onActionClick('retest')}
          className="rounded-2xl border border-dashed border-primary/30 hover:border-primary/60 bg-primary/[0.02] hover:bg-primary/[0.04] p-4 text-left transition-all cursor-pointer flex flex-col justify-between h-36"
        >
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-primary tracking-wider">
              <CheckSquare size={12} />
              Następny krok
            </div>
            <p className="text-sm font-black text-text-primary mt-2">
              Zaplanuj kolejny panel badań
            </p>
          </div>
          <div className="flex items-center gap-1 text-2xs font-black text-primary uppercase">
            Przejdź do planu <ArrowRight size={10} />
          </div>
        </button>
      </div>
    </div>
  );
}
