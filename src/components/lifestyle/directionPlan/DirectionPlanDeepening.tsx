type Phase2Recap = {
  narrative_check: string;
  deepening_questions?: string[];
};

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-2xs uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

interface DirectionPlanDeepeningProps {
  phase2: Phase2Recap | null;
  phase2Loading: boolean;
  deepeningAnswers: Record<string, string>;
  setDeepeningAnswers: (v: Record<string, string>) => void;
}

export default function DirectionPlanDeepening({ phase2, phase2Loading, deepeningAnswers, setDeepeningAnswers }: DirectionPlanDeepeningProps) {
  const deepeningQuestions = phase2?.deepening_questions ?? [];
  if (!phase2 && !phase2Loading) return null;

  return (
    <div className="space-y-4">
      <Divider title="Zagłębmy się" />
      {phase2 && <p className="text-sm text-text-primary leading-relaxed">{phase2.narrative_check}</p>}
      {deepeningQuestions.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted font-medium">Odpowiedz na wszystkie {deepeningQuestions.length} żeby kontynuować</p>
          {deepeningQuestions.map((q, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs text-text-secondary font-medium">{i + 1}. {q}</p>
              <textarea
                value={deepeningAnswers[String(i)] ?? ""}
                onChange={(e) => setDeepeningAnswers({ ...deepeningAnswers, [String(i)]: e.target.value })}
                placeholder="Twoja odpowiedź…"
                rows={2}
                className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-y min-h-[64px] focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
