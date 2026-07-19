import { useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Upload, AlertCircle, CheckCircle2, ChevronRight, FileText, Check } from 'lucide-react';
import { notify } from '../../../lib/notify';

interface MedicalImportProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (results: any[], docName: string) => Promise<void>;
}

type Step = 'upload' | 'verify' | 'deltas';

export default function MedicalImport({ isOpen, onClose, onConfirmImport }: MedicalImportProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Mock parsed results from pdf
  const [parsedMarkers, setParsedMarkers] = useState([
    { key: 'glucose', name: 'Glukoza', value: 92, unit: 'mg/dl', refLow: 70, refHigh: 99, isUncertain: false, isDuplicate: false, delta: -3 },
    { key: 'tsh', name: 'TSH (Thyrotropin)', value: 1.85, unit: 'µIU/ml', refLow: 0.27, refHigh: 4.2, isUncertain: true, isDuplicate: false, delta: 0.15 },
    { key: 'ferritin', name: 'Ferrytyna', value: 85, unit: 'µg/l', refLow: 30, refHigh: 400, isUncertain: false, isDuplicate: true, delta: -12 }
  ]);

  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFileName(e.dataTransfer.files[0].name);
      setStep('verify');
    }
  };

  const simulateUpload = () => {
    setFileName('panel_lipidy_glukoza_diagnostyka.pdf');
    setStep('verify');
  };

  const toggleMarkerApprove = (index: number, field: 'isUncertain' | 'isDuplicate') => {
    const updated = [...parsedMarkers];
    updated[index][field] = !updated[index][field];
    setParsedMarkers(updated);
  };

  const handleSave = async () => {
    // Generate simple rows mapping database schema
    const rows = parsedMarkers.map(m => ({
      marker_key: m.key,
      marker_name: m.name,
      value: m.value,
      unit: m.unit,
      ref_low: m.refLow,
      ref_high: m.refHigh,
      flag: m.value < m.refLow ? 'L' : m.value > m.refHigh ? 'H' : 'N',
      category: m.key === 'glucose' ? 'Metabolizm' : m.key === 'tsh' ? 'Tarczyca' : 'Krew'
    }));

    try {
      await onConfirmImport(rows, fileName);
      notify('Wyniki zostały pomyślnie zaimportowane!', 'success');
      setStep('upload');
      onClose();
    } catch (e) {
      notify('Wystąpił błąd podczas importu', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importuj Wyniki Laboratoryjne">
      <div className="space-y-6 py-2">
        {step === 'upload' && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={simulateUpload}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragActive ? 'border-primary bg-primary/[0.03]' : 'border-border-custom hover:border-primary/50 bg-background/20'
            }`}
          >
            <Upload size={32} className="mx-auto text-text-muted" />
            <p className="text-sm font-bold text-text-primary mt-4">
              Przeciągnij i upuść PDF z wynikami lub zdjęcie raportu
            </p>
            <p className="text-2xs text-text-muted mt-1.5">
              Obsługujemy laboratoria Alab, Diagnostyka, Synevo i inne. Maksymalny rozmiar 10MB.
            </p>
            <Button variant="outline" size="sm" className="mt-6 mx-auto uppercase font-black text-2xs tracking-wider">
              Wybierz Plik z Dysku
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-custom pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <FileText size={14} className="text-primary" /> {fileName}
              </span>
              <span className="text-3xs bg-warning/10 text-warning px-2 py-0.5 rounded font-black uppercase">
                Krok 1: Weryfikacja
              </span>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Zweryfikuj poprawność odczytanych markerów. Oznacz niepewne wartości lub zatwierdź duplikaty.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {parsedMarkers.map((m, idx) => (
                <div key={m.key} className="bg-background/40 border border-border-custom rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{m.name}</h4>
                    <span className="text-3xs text-text-muted font-mono">{m.value} {m.unit} (zakres: {m.refLow}-{m.refHigh})</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleMarkerApprove(idx, 'isUncertain')}
                      className={`text-3xs font-black uppercase tracking-wider px-2 py-1 rounded transition-colors cursor-pointer ${
                        m.isUncertain ? 'bg-warning text-on-accent' : 'bg-border-custom text-text-muted'
                      }`}
                    >
                      Niepewny odczyt
                    </button>
                    <button
                      onClick={() => toggleMarkerApprove(idx, 'isDuplicate')}
                      className={`text-3xs font-black uppercase tracking-wider px-2 py-1 rounded transition-colors cursor-pointer ${
                        m.isDuplicate ? 'bg-red-500 text-on-accent' : 'bg-border-custom text-text-muted'
                      }`}
                    >
                      Duplikat
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep('upload')}>Wstecz</Button>
              <Button variant="outline" onClick={() => setStep('deltas')} className="text-primary border-primary/30">
                Podgląd zmian <ChevronRight size={12} className="inline ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 'deltas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-custom pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <FileText size={14} className="text-primary" /> {fileName}
              </span>
              <span className="text-3xs bg-success/10 text-success px-2 py-0.5 rounded font-black uppercase">
                Krok 2: Zmiany (Deltas)
              </span>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Zestawienie zmian względem poprzedniego zarejestrowanego panelu przed zapisem.
            </p>

            <div className="space-y-2">
              {parsedMarkers.map(m => (
                <div key={m.key} className="bg-background/40 border border-border-custom rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-text-secondary">{m.name}</span>
                  <div className="text-right">
                    <span className="text-xs font-black text-text-primary">{m.value} {m.unit}</span>
                    <span className={`text-2xs font-bold block ${m.delta > 0 ? 'text-primary' : 'text-text-muted'}`}>
                      {m.delta > 0 ? '+' : ''}{m.delta} {m.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep('verify')}>Wstecz</Button>
              <Button variant="outline" onClick={handleSave} className="text-success border-success/30">
                <Check size={12} className="inline mr-1" /> Zapisz w historii
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
