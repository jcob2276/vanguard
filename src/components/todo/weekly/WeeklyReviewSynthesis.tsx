import React from 'react';
import { useWeeklyReview } from './context/WeeklyReviewContext';
import { Sparkles, Trash2 } from 'lucide-react';

export default function WeeklyReviewSynthesis() {
  const {
    aiRecap,
    weeklyNote,
    setWeeklyNote,
    stagedPredictions,
    setStagedPredictions,
    newPredictionText,
    setNewPredictionText,
    newPredictionConfidence,
    setNewPredictionConfidence,
  } = useWeeklyReview();

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles size={15} className="text-primary" />
          Krok 5: Synteza Tygodnia
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          Podsumuj krótko ten tydzień. Jakie są Twoje najważniejsze lekcje i skupienie na kolejny tydzień?
        </p>
      </div>

      {aiRecap?.phase1?.narrative && (
        <div className="bg-primary/50 dark:bg-primary/20 border border-primary dark:border-primary/40 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-primary dark:text-primary">
            <Sparkles size={14} className="text-primary" />
            <span>System widzi (Podsumowanie):</span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line font-medium">
            {aiRecap.phase1.narrative}
          </p>
          {aiRecap.phase1.question && (
            <div className="pt-2 border-t border-primary dark:border-primary/30">
              <span className="text-xs font-bold text-primary dark:text-primary block uppercase tracking-wider">
                Pytanie pomocnicze:
              </span>
              <p className="text-sm text-text-secondary font-semibold italic mt-0.5 text-primary dark:text-primary">
                "{aiRecap.phase1.question}"
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <span className="text-xs font-bold text-text-primary block uppercase tracking-wider">
          Notatka tygodniowa
        </span>
        <textarea
          value={weeklyNote}
          onChange={(e) => setWeeklyNote(e.target.value)}
          placeholder="Zapisz refleksje, np. 'Wyczyściłem 15 zaległych zadań, przełożyłem 3 projekty. W kolejnym tygodniu skupiam się na wdrożeniach Vanguard.'"
          rows={4}
          className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-sm font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-primary/50 outline-none transition-colors resize-none"
        />
      </div>

      {/* STAGING FUTURE PREDICTIONS */}
      <div className="space-y-3 pt-3 border-t border-border-custom/20">
        <div>
          <span className="text-xs font-bold text-text-primary block uppercase tracking-wider">
            Prognozy na nadchodzący tydzień
          </span>
          <p className="text-2xs text-text-muted">
            Zadeklaruj 1-2 zero-jedynkowe zdarzenia, które prognozujesz na kolejny tydzień wraz z pewnością.
          </p>
        </div>

        {/* Staged list */}
        {stagedPredictions.length > 0 && (
          <div className="space-y-1.5">
            {stagedPredictions.map((staged, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.02] border border-border-custom/50 rounded-lg p-2.5"
              >
                <div className="flex flex-col border-none">
                  <span className="text-xs font-bold text-text-primary">{staged.metric}</span>
                  <span className="text-2xs text-primary font-semibold">
                    Pewność: {(staged.value * 100).toFixed(0)}%
                  </span>
                </div>
                <button
                  onClick={() => setStagedPredictions((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-text-muted hover:text-danger transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add prediction inputs */}
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col space-y-1.5">
            <input
              type="text"
              value={newPredictionText}
              onChange={(e) => setNewPredictionText(e.target.value)}
              placeholder="np. Przebiegnę 10km w czasie < 50 min"
              className="bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-primary/50 outline-none transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                Pewność: {(newPredictionConfidence * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min="0.5"
                max="0.99"
                step="0.05"
                value={newPredictionConfidence}
                onChange={(e) => setNewPredictionConfidence(parseFloat(e.target.value))}
                className="w-24 accent-indigo-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!newPredictionText.trim()) return;
              setStagedPredictions((prev) => [
                ...prev,
                { metric: newPredictionText.trim(), value: newPredictionConfidence },
              ]);
              setNewPredictionText('');
              setNewPredictionConfidence(0.8);
            }}
            className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center transition-colors self-start shrink-0"
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}
