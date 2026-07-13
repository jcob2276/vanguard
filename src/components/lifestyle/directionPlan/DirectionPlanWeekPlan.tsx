import { formatSprintWeekBridge } from '../../../lib/goal/goalSpine';
import { formatSprintFromLongTerm } from '../../../lib/goal/longTermBridge';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

type Phase2Recap = {
  block5_material?: { cialo: string; duch: string; konto: string };
};

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-[9px] uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-y min-h-[80px] focus:outline-none focus:border-primary/50 transition-colors" />
  );
}

interface DirectionPlanWeekPlanProps {
  phase2: Phase2Recap | null;
  weekStart: string;
  planWeekStart: string;
  direction: {
    sprintGoal: string | null;
    bhagLine: string | null;
    monthTheme: string | null;
    monthLabel: string | null;
  };
  weekIntention: string; setWeekIntention: (v: string) => void;
  weekCommitment: string; setWeekCommitment: (v: string) => void;
  weekGoalCialo: string; setWeekGoalCialo: (v: string) => void;
  weekGoalDuch: string; setWeekGoalDuch: (v: string) => void;
  weekGoalKonto: string; setWeekGoalKonto: (v: string) => void;
  onComplete: () => void;
  completing: boolean;
  deepeningComplete: boolean;
  intentionFromMonth?: boolean;
  planCarriedFromMonth?: boolean;
}

export default function DirectionPlanWeekPlan({
  phase2, weekStart, planWeekStart, direction,
  weekIntention, setWeekIntention, weekCommitment, setWeekCommitment,
  weekGoalCialo, setWeekGoalCialo, weekGoalDuch, setWeekGoalDuch,
  weekGoalKonto, setWeekGoalKonto,
  onComplete, completing, deepeningComplete,
  intentionFromMonth, planCarriedFromMonth,
}: DirectionPlanWeekPlanProps) {
  const block5material = phase2?.block5_material;
  const weekStepDraft = weekIntention.trim() || weekCommitment.trim() || null;
  const sprintBridge = formatSprintWeekBridge(direction.sprintGoal, weekStepDraft);
  const longTermBridge = formatSprintFromLongTerm(direction.bhagLine ?? null, direction.sprintGoal);

  return (
    <div className={`space-y-4 transition-opacity duration-300 ${deepeningComplete ? "" : "opacity-30 pointer-events-none"}`}>
      <Divider title="Plan tygodnia" />
      {planWeekStart !== weekStart && (
        <p className="text-[10px] font-semibold text-text-muted">Cele zapiszą się na tydzień od {planWeekStart}</p>
      )}

      {block5material && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Sugestie AI</p>
          {(direction.monthTheme || sprintBridge || longTermBridge) && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-3 py-2.5 space-y-1.5">
              {longTermBridge && <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{longTermBridge}</p>}
              {direction.monthTheme && (
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  <span className="font-black uppercase tracking-wider text-indigo-600 text-[9px]">Temat miesiąca{direction.monthLabel ? ` · ${direction.monthLabel}` : ''}:{' '}</span>
                  {direction.monthTheme}
                </p>
              )}
              {sprintBridge && <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{sprintBridge}</p>}
            </div>
          )}
          {(["cialo", "duch", "konto"] as const).map((p) =>
            block5material[p] ? (
              <div key={p} className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">{p === "cialo" ? "Ciało" : p === "duch" ? "Duch" : "Konto"}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{block5material[p]}</p>
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="space-y-4">
        {(direction.monthTheme || direction.sprintGoal || direction.bhagLine) && (
          <Card padding="0.625rem 0.75rem" className="space-y-1.5" style={{ background: 'rgba(11, 15, 25, 0.5)' }}>
            {longTermBridge && <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{longTermBridge}</p>}
            {direction.monthTheme && (
              <p className="text-[11px] text-text-secondary leading-relaxed">
                <span className="font-black uppercase tracking-wider text-indigo-600 text-[9px]">Temat miesiąca{direction.monthLabel ? ` · ${direction.monthLabel}` : ''}:{' '}</span>
                {direction.monthTheme}
              </p>
            )}
            {sprintBridge && <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{sprintBridge}</p>}
          </Card>
        )}
        <div className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Intencja tygodnia — jaki chcę być?</p>
          {intentionFromMonth && weekIntention.trim() && <p className="text-[10px] font-semibold text-indigo-600">Wstępnie z tematu miesiąca — doprecyzuj pod ten tydzień.</p>}
          <Textarea value={weekIntention} onChange={setWeekIntention} placeholder="Np. konsekwentny, spokojny, zdecydowany…" rows={2} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Zobowiązanie — co jest bezwzględne?</p>
          {planCarriedFromMonth && weekCommitment.trim() && <p className="text-[10px] font-semibold text-indigo-600">Z korekty miesiąca — jedna rzecz do poprawy w tym tygodniu.</p>}
          <Textarea value={weekCommitment} onChange={setWeekCommitment} placeholder="Jedna rzecz której nie odpuszczę bez względu na wszystko…" rows={2} />
        </div>
        <div className="pt-3 space-y-3 border-t border-border-custom">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">3 duże cele na ten tydzień</p>
          {planCarriedFromMonth && <p className="text-[10px] font-semibold text-indigo-600">Cele filarów wstępnie z przeglądu miesiąca (korekta / dźwignia).</p>}
          <div className="space-y-1">
            <p className="text-xs text-text-muted font-medium">Ciało</p>
            <Textarea value={weekGoalCialo} onChange={setWeekGoalCialo} placeholder="Jeden konkretny cel fizyczny…" rows={2} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-text-muted font-medium">Duch</p>
            <Textarea value={weekGoalDuch} onChange={setWeekGoalDuch} placeholder="Jeden konkretny cel mentalny / relacyjny…" rows={2} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-text-muted font-medium">Konto</p>
            <Textarea value={weekGoalKonto} onChange={setWeekGoalKonto} placeholder="Jeden konkretny cel finansowy / zawodowy…" rows={2} />
          </div>
        </div>
        <Button onClick={onComplete} disabled={!deepeningComplete} loading={completing} variant="primary" className="w-full">
          {completing ? "Zamykam tydzień…" : "Zakończ przegląd tygodnia"}
        </Button>
      </div>
    </div>
  );
}
