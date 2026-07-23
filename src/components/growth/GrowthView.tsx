import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useGrowthData } from './hooks/useGrowthData';
import { useGrowthViewDerived } from './useGrowthViewDerived';
import { updateVanguardIdentity } from '../../lib/growth/growthIdentityApi';
import { notify } from '../../lib/notify';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';

// New Sections
import GrowthHeaderSection from './sections/GrowthHeaderSection';
import GrowthIdentitySection from './sections/GrowthIdentitySection';
import GrowthCapacityMapSection from './sections/GrowthCapacityMapSection';
import GrowthActivePathSection from './sections/GrowthActivePathSection';
import GrowthLibrarySection from './sections/GrowthLibrarySection';
import GrowthPracticeSection from './sections/GrowthPracticeSection';
import GrowthReviewSection from './sections/GrowthReviewSection';
import GrowthModals from './sections/GrowthModals';

import type { DevelopmentReview, LibraryItem, PracticeEvidence, VanguardIdentityData } from '../../lib/growth/growth.types';

export default function GrowthView({ session }: { session: Session }) {
  const userId = session.user.id;
  const [weekStart] = useState(() => getTodayWarsaw()); // Fixed reference date context
  const data = useGrowthData(userId, weekStart);
  
  const { skills, snapshots, focus, pins, unreadLinks, readLinks, openTodos, activeProjects, weekNotes, loading, refresh } = data;

  const derived = useGrowthViewDerived({
    weekStart,
    skills,
    snapshots,
    focus,
    pins,
    unreadLinks,
    readLinks,
    openTodos,
    activeProjects,
    weekNotes,
  });

  const { skillInventory } = derived;
  const identity = data.identity;

  // Modals state
  const [activeModal, setActiveModal] = useState<'direction' | 'identity' | 'library' | 'practice' | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null);
  const [selectedPracticeItem, setSelectedPracticeItem] = useState<PracticeEvidence | null>(null);

  const handleSaveIdentity = async (updates: Partial<VanguardIdentityData>) => {
    try {
      await updateVanguardIdentity(userId, updates);
      notify('Zapisano pomyślnie!', 'success');
      await refresh();
    } catch (e: unknown) {
      console.error(e);
      notify('Wystąpił błąd podczas zapisu', 'error');
    }
  };

  const handleSaveReview = async (reviewData: DevelopmentReview) => {
    await handleSaveIdentity({
      development_review: reviewData
    });
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
            <h1 className="text-xl font-black font-display uppercase tracking-tight">Zoom-out Rozwoju</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-[var(--ds-maxw-1600px)] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-6">
        {/* Section 1: Header */}
        <GrowthHeaderSection 
          identity={identity} 
          skills={skills} 
          onEdit={() => setActiveModal('direction')} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 2: Identity */}
          <GrowthIdentitySection 
            identity={identity} 
            onEdit={() => setActiveModal('identity')} 
          />

          {/* Section 4: Active Path */}
          <GrowthActivePathSection 
            identity={identity} 
            skills={skills} 
            onEdit={() => setActiveModal('direction')} 
          />
        </div>

        {/* Section 3: Capacity Map */}
        <GrowthCapacityMapSection 
          skillInventory={skillInventory} 
          onEdit={() => {
            // Re-uses standard skills assessment or opens evaluation
            notify('Użyj przycisku w prawym górnym rogu na Dziś/Tydzień aby oceniać pojedyncze skille.', 'info');
          }}
        />

        {/* Section 5: Knowledge Library */}
        <GrowthLibrarySection 
          items={identity?.library_items || []} 
          onAdd={() => {
            setSelectedLibraryItem(null);
            setActiveModal('library');
          }}
          onEditItem={(item) => {
            setSelectedLibraryItem(item);
            setActiveModal('library');
          }}
        />

        {/* Section 6: Practice & Evidence */}
        <GrowthPracticeSection 
          evidences={identity?.practice_evidences || []} 
          skills={skills} 
          onAdd={() => {
            setSelectedPracticeItem(null);
            setActiveModal('practice');
          }}
          onEditItem={(item) => {
            setSelectedPracticeItem(item);
            setActiveModal('practice');
          }}
        />

        {/* Section 7: Review */}
        <GrowthReviewSection 
          currentReview={identity?.development_review ?? null}
          onSaveReview={handleSaveReview} 
        />
      </div>

      <GrowthModals
        activeModal={activeModal}
        onClose={() => {
          setActiveModal(null);
          setSelectedLibraryItem(null);
          setSelectedPracticeItem(null);
        }}
        identity={identity}
        skills={skills}
        editingLibraryItem={selectedLibraryItem}
        editingPracticeItem={selectedPracticeItem}
        onSaveIdentity={handleSaveIdentity}
      />
    </div>
  );
}
