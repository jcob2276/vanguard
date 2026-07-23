import { useState, type DragEvent } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Upload } from 'lucide-react';
import { notify } from '../../../lib/notify';
import { MedicalImportDeltaStep, MedicalImportVerifyStep, type ParsedMedicalMarker } from './MedicalImportSteps';

export interface ImportedMedicalResult {
  marker_key: string;
  marker_name: string;
  value: number;
  unit: string;
  ref_low: number;
  ref_high: number;
  flag: 'L' | 'H' | 'N';
  category: string;
}

interface MedicalImportProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (results: ImportedMedicalResult[], docName: string) => Promise<void>;
}

type Step = 'upload' | 'verify' | 'deltas';

export default function MedicalImport({ isOpen, onClose, onConfirmImport }: MedicalImportProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [parsedMarkers, setParsedMarkers] = useState<ParsedMedicalMarker[]>([
    { key: 'glucose', name: 'Glukoza', value: 92, unit: 'mg/dl', refLow: 70, refHigh: 99, isUncertain: false, isDuplicate: false, delta: -3 },
    { key: 'tsh', name: 'TSH (Thyrotropin)', value: 1.85, unit: 'µIU/ml', refLow: 0.27, refHigh: 4.2, isUncertain: true, isDuplicate: false, delta: 0.15 },
    { key: 'ferritin', name: 'Ferrytyna', value: 85, unit: 'µg/l', refLow: 30, refHigh: 400, isUncertain: false, isDuplicate: true, delta: -12 }
  ]);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
    const rows: ImportedMedicalResult[] = parsedMarkers.map(m => ({
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
    } catch {
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
          <MedicalImportVerifyStep fileName={fileName} markers={parsedMarkers} onToggle={toggleMarkerApprove} onBack={() => setStep('upload')} onNext={() => setStep('deltas')} />
        )}
        {step === 'deltas' && (
          <MedicalImportDeltaStep fileName={fileName} markers={parsedMarkers} onBack={() => setStep('verify')} onSave={handleSave} />
        )}
      </div>
    </Modal>
  );
}
