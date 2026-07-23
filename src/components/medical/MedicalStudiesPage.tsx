import { useState, useMemo } from 'react';
import { useUserId } from '../../store/useStore';
import { useMedicalData } from './hooks/useMedicalData';
import { useRetestSuggestions } from './hooks/useMedicalRetestContext';
import { buildMarkerSeries } from '../../lib/health/medicalAnalytics';
import { computeBiologyScoresLite } from '../../lib/getBased/biologyScoresLite';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { getTodayWarsaw } from '../../lib/date';

// Subsections Components
import MedicalHeader from './sections/MedicalHeader';
import MedicalOverview from './sections/MedicalOverview';
import MedicalResultsTable from './sections/MedicalResultsTable';
import MedicalTrends from './sections/MedicalTrends';
import MedicalDocHistory from './sections/MedicalDocHistory';
import MedicalBiologyScoresSection from './sections/MedicalBiologyScoresSection';
import MedicalSuggestions from './sections/MedicalSuggestions';
import MedicalBodyComposition from './sections/MedicalBodyComposition';

// Modals / Overlays
import MedicalMarkerInspector from './sections/MedicalMarkerInspector';
import MedicalImport from './sections/MedicalImport';
import type { ImportedMedicalResult } from './sections/MedicalImport';

export default function MedicalStudiesPage() {
  const userId = useUserId();
  const { labs, bodyComposition, documents, loading, refresh } = useMedicalData(userId!);

  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Derive series & calculations
  const series = useMemo(() => buildMarkerSeries(labs), [labs]);
  const biologyScores = useMemo(() => computeBiologyScoresLite(series), [series]);
  
  const { suggestions, loading: retestLoading } = useRetestSuggestions(
    userId!,
    series,
    labs,
  );

  const handleConfirmImport = async (results: ImportedMedicalResult[], docName: string) => {
    if (!userId) return;

    // 1. Create medical document record
    const docRow: Database['public']['Tables']['medical_documents']['Insert'] = {
      user_id: userId,
      document_date: getTodayWarsaw(),
      document_type: 'processed',
      source_name: docName,
      provider: 'Diagnostyka',
      clinical_validity: 'clinical'
    };

    const { error: docErr } = await supabase
      .from('medical_documents')
      .insert(docRow)
      .select()
      .maybeSingle();

    if (docErr) {
      console.error(docErr);
      throw docErr;
    }

    // 2. Map & insert lab results
    const labRows: Database['public']['Tables']['medical_lab_results']['Insert'][] = results.map(r => ({
      user_id: userId,
      result_date: getTodayWarsaw(),
      marker_key: r.marker_key,
      marker_name: r.marker_name,
      value: Number(r.value),
      unit: r.unit,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      flag: r.flag,
      category: r.category,
      source_name: docName,
      provider: 'Diagnostyka'
    }));

    const { error: labErr } = await supabase
      .from('medical_lab_results')
      .insert(labRows);

    if (labErr) {
      console.error(labErr);
      throw labErr;
    }

    await refresh();
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-border-custom bg-background/95 backdrop-blur-[var(--blur-md)]">
        <div className="w-full max-w-[var(--ds-maxw-1600px)] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
          <Link
            to="/"
            aria-label="Wróć do widoku głównego"
            className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black font-display uppercase tracking-tight">Dokumentacja Medyczna</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-[var(--ds-maxw-1600px)] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-10">
        {/* Header block (Completeness, attention and import trigger) */}
        <MedicalHeader
          labs={labs}
          documents={documents}
          onImportClick={() => setImportOpen(true)}
          onViewResults={() => scrollToSection('wyniki')}
          onPlanRetest={() => scrollToSection('sugestie')}
        />

        {/* Level 1: Przegląd */}
        <div id="przeglad">
          <MedicalOverview
            labs={labs}
            onActionClick={scrollToSection}
          />
        </div>

        {/* Level 2: Wyniki Table */}
        <div id="wyniki">
          <MedicalResultsTable
            labs={labs}
            onSelectMarker={setSelectedMarkerKey}
          />
        </div>

        {/* Level 3: Trendy */}
        <div id="trendy">
          <MedicalTrends labs={labs} />
        </div>

        {/* Level 4: Dokumenty history */}
        <div id="dokumenty">
          <MedicalDocHistory documents={documents} />
        </div>

        {/* Co warto badać section */}
        <div id="sugestie">
          <MedicalSuggestions
            suggestions={suggestions}
            loading={retestLoading}
          />
        </div>

        {/* Eksperymentalne wskaźniki (Biology Scores) */}
        <div id="scores">
          <MedicalBiologyScoresSection scores={biologyScores} />
        </div>

        {/* Body compositions section */}
        <div id="cialo">
          <MedicalBodyComposition rows={bodyComposition} />
        </div>
      </div>

      {/* Marker side drawer details */}
      <MedicalMarkerInspector
        markerKey={selectedMarkerKey}
        labs={labs}
        onClose={() => setSelectedMarkerKey(null)}
      />

      {/* Import results wizard */}
      <MedicalImport
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
}
