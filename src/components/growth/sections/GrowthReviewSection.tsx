import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';
import { ControlTextarea } from '../../ui/ControlPrimitives';
import type { DevelopmentReview } from '../../../lib/growth/growth.types';

interface GrowthReviewSectionProps {
  currentReview: DevelopmentReview | null;
  onSaveReview: (reviewData: DevelopmentReview) => Promise<void>;
}

export default function GrowthReviewSection({ currentReview, onSaveReview }: GrowthReviewSectionProps) {
  const [editing, setEditing] = useState(false);
  const [learned, setLearned] = useState(currentReview?.learned || '');
  const [applied, setApplied] = useState(currentReview?.applied || '');
  const [results, setResults] = useState(currentReview?.results || '');
  const [consumedOnly, setConsumedOnly] = useState(currentReview?.consumedOnly || '');
  const [abandoned, setAbandoned] = useState(currentReview?.abandoned || '');
  const [newGap, setNewGap] = useState(currentReview?.newGap || '');
  const [nextPractice] = useState(currentReview?.nextPractice || '');

  const handleSave = async () => {
    await onSaveReview({
      learned,
      applied,
      results,
      consumedOnly,
      abandoned,
      newGap,
      nextPractice,
      updatedAt: new Date().toISOString()
    });
    setEditing(false);
  };

  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Przegląd i Refleksja</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Przegląd Rozwoju</h3>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="uppercase font-black text-2xs">
            Nowy Przegląd
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="uppercase font-black text-2xs">
              Anuluj
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} className="uppercase font-black text-2xs text-primary">
              Zapisz
            </Button>
          </div>
        )}
      </div>

      {!editing ? (
        currentReview?.updatedAt ? (
          <div className="space-y-4">
            <p className="text-2xs text-text-muted font-bold flex items-center gap-1">
              <Calendar size={12} /> Ostatni przegląd: {currentReview.updatedAt.slice(0, 10)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-primary tracking-wider">Czego się nauczyłem</p>
                <p className="text-xs text-text-secondary">{currentReview.learned || '—'}</p>
              </div>
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-success tracking-wider">Co zastosowałem w praktyce</p>
                <p className="text-xs text-text-secondary">{currentReview.applied || '—'}</p>
              </div>
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-success tracking-wider">Co przyniosło realny rezultat</p>
                <p className="text-xs text-text-secondary">{currentReview.results || '—'}</p>
              </div>
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-warning tracking-wider">Co tylko skonsumowałem (hoarding)</p>
                <p className="text-xs text-text-secondary">{currentReview.consumedOnly || '—'}</p>
              </div>
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-text-muted tracking-wider">Co porzucam / odkładam</p>
                <p className="text-xs text-text-secondary">{currentReview.abandoned || '—'}</p>
              </div>
              <div className="rounded-xl border border-border-custom/55 bg-background/20 p-4 space-y-1">
                <p className="text-2xs font-black uppercase text-primary tracking-wider">Jaka luka jest teraz najważniejsza</p>
                <p className="text-xs text-text-secondary">{currentReview.newGap || '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-custom py-12 text-center">
            <p className="text-xs text-text-muted italic">Brak aktywnego przeglądu. Rozpocznij nowy, aby dokonać syntezy postępów.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Czego się nauczyłeś?</label>
              <ControlTextarea value={learned} onChange={e => setLearned(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Kluczowe koncepcje, zasady, notatki..." />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Co faktycznie zastosowałeś w praktyce?</label>
              <ControlTextarea value={applied} onChange={e => setApplied(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Treningi, rozmowy, wdrożenia..." />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Co przyniosło realny rezultat?</label>
              <ControlTextarea value={results} onChange={e => setResults(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Zmiany w zachowaniu, mierzalne wyniki..." />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Co tylko skonsumowałeś (brak pętli)?</label>
              <ControlTextarea value={consumedOnly} onChange={e => setConsumedOnly(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Książki bez notatki, kursy bez ćwiczeń..." />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Co świadomie porzucasz / odsuwasz?</label>
              <ControlTextarea value={abandoned} onChange={e => setAbandoned(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Materiały, które nie służą obecnemu kierunkowi..." />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-black uppercase text-text-muted">Jaka luka/umiejętność jest teraz priorytetem?</label>
              <ControlTextarea value={newGap} onChange={e => setNewGap(e.target.value)} rows={3} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Luka do zaadresowania w kolejnym cyklu..." />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
