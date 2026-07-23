import { Check, ChevronRight, FileText } from 'lucide-react';
import Button from '../../ui/Button';
import { Pressable } from '../../ui/ControlPrimitives';

export interface ParsedMedicalMarker {
  key: string;
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  isUncertain: boolean;
  isDuplicate: boolean;
  delta: number;
}

interface VerifyProps {
  fileName: string;
  markers: ParsedMedicalMarker[];
  onToggle: (index: number, field: 'isUncertain' | 'isDuplicate') => void;
  onBack: () => void;
  onNext: () => void;
}

export function MedicalImportVerifyStep({ fileName, markers, onToggle, onBack, onNext }: VerifyProps) {
  return (
    <div className="space-y-4">
      <StepHeader fileName={fileName} label="Krok 1: Weryfikacja" tone="warning" />
      <p className="text-xs leading-relaxed text-text-muted">Zweryfikuj odczytane markery i oznacz niepewne wartości lub duplikaty.</p>
      <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
        {markers.map((marker, index) => (
          <div key={marker.key} className="flex flex-col justify-between gap-3 rounded-xl border border-border-custom bg-background/40 p-3 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-xs font-bold text-text-primary">{marker.name}</h4>
              <span className="font-mono text-3xs text-text-muted">{marker.value} {marker.unit} (zakres: {marker.refLow}–{marker.refHigh})</span>
            </div>
            <div className="flex gap-2">
              <MarkerFlag active={marker.isUncertain} tone="warning" onClick={() => onToggle(index, 'isUncertain')}>Niepewny</MarkerFlag>
              <MarkerFlag active={marker.isDuplicate} tone="danger" onClick={() => onToggle(index, 'isDuplicate')}>Duplikat</MarkerFlag>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>Wstecz</Button>
        <Button variant="outline" onClick={onNext}>Podgląd zmian <ChevronRight size={12} /></Button>
      </div>
    </div>
  );
}

export function MedicalImportDeltaStep({ fileName, markers, onBack, onSave }: {
  fileName: string; markers: ParsedMedicalMarker[]; onBack: () => void; onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <StepHeader fileName={fileName} label="Krok 2: Zmiany" tone="success" />
      <p className="text-xs leading-relaxed text-text-muted">Zmiany względem poprzedniego panelu przed zapisem.</p>
      <div className="space-y-2">
        {markers.map((marker) => (
          <div key={marker.key} className="flex items-center justify-between rounded-xl border border-border-custom bg-background/40 p-3">
            <span className="text-xs font-semibold text-text-secondary">{marker.name}</span>
            <div className="text-right">
              <span className="text-xs font-black">{marker.value} {marker.unit}</span>
              <span className={`block text-2xs font-bold ${marker.delta > 0 ? 'text-primary' : 'text-text-muted'}`}>{marker.delta > 0 ? '+' : ''}{marker.delta} {marker.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>Wstecz</Button>
        <Button variant="outline" onClick={onSave}><Check size={12} /> Zapisz w historii</Button>
      </div>
    </div>
  );
}

function StepHeader({ fileName, label, tone }: { fileName: string; label: string; tone: 'warning' | 'success' }) {
  const toneClass = tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';
  return <div className="flex items-center justify-between border-b border-border-custom pb-2"><span className="flex items-center gap-1.5 text-xs font-bold"><FileText size={14} className="text-primary" />{fileName}</span><span className={`rounded px-2 py-0.5 text-3xs font-black uppercase ${toneClass}`}>{label}</span></div>;
}

function MarkerFlag({ active, tone, onClick, children }: { active: boolean; tone: 'warning' | 'danger'; onClick: () => void; children: string }) {
  const activeClass = tone === 'warning' ? 'bg-warning text-on-accent' : 'bg-danger text-on-accent';
  return <Pressable onClick={onClick} className={`rounded px-2 py-1 text-3xs font-black uppercase ${active ? activeClass : 'bg-border-custom text-text-muted'}`}>{children}</Pressable>;
}
