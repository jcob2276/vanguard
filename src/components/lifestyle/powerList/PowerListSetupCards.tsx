import { CheckCircle2, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { Card } from '../../ui/Card';
import { ControlTextarea, Pressable } from '../../ui/ControlPrimitives';
import type { Tables } from '../../../lib/database.types';
import type { DailyWinWithTasks } from '../usePowerListData';

interface RecapProps {
  yesterdayWin: DailyWinWithTasks | null;
  yesterdayNote: string;
  setYesterdayNote: (value: string) => void;
  yesterdayNoteRequired: boolean;
}

export function YesterdayRecap({ yesterdayWin, yesterdayNote, setYesterdayNote, yesterdayNoteRequired }: RecapProps) {
  if (!yesterdayWin) return null;
  const ready = !yesterdayNoteRequired || Boolean(yesterdayNote.trim());
  return (
    <Card variant={ready ? 'surface' : 'notice'} padding="1rem" className={`space-y-3 ${ready ? 'border-success/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Refleksja · {yesterdayWin.date}</p>
          <h4 className="mt-1 font-display text-sm font-black text-text-primary">Co zadziałało, a co przeszkodziło?</h4>
        </div>
        {ready ? <CheckCircle2 size={18} className="shrink-0 text-success" /> : <MessageCircleQuestion size={18} className="shrink-0 text-warning" />}
      </div>
      <ul className="space-y-1.5 rounded-xl bg-surface-tonal p-3">
        {(yesterdayWin.daily_win_tasks || []).map((task: Tables<'daily_win_tasks'>) => (
          <li key={task.id} className="flex items-center gap-2 text-xs font-medium">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.done ? 'bg-success' : 'bg-text-muted/30'}`} />
            <span className={task.done ? 'text-text-secondary line-through opacity-[var(--opacity-70)]' : 'text-text-primary'}>{task.title}</span>
          </li>
        ))}
      </ul>
      <div>
        <label htmlFor="yesterday-reflection" className="text-xs font-semibold leading-relaxed text-text-secondary">
          Jedno szczere zdanie wystarczy.
          {yesterdayNoteRequired ? <span className="ml-1 font-bold text-warning">Wymagane</span> : null}
        </label>
        <ControlTextarea id="yesterday-reflection" value={yesterdayNote} onChange={(event) => setYesterdayNote(event.target.value)} placeholder="Co pomogło lub zatrzymało realizację?" rows={3} className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50" />
      </div>
    </Card>
  );
}

interface AiProps { aiLoading: boolean; aiQuestions: string | null; generateQuestions: () => void; }

export function AiHelper({ aiLoading, aiQuestions, generateQuestions }: AiProps) {
  return (
    <Card variant="accent" padding="0.875rem" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary"><Sparkles size={12} /> Pytania pomocnicze</span>
        <Pressable onClick={generateQuestions} disabled={aiLoading} className="shrink-0 rounded-full border border-primary/20 bg-surface-solid px-3 py-1.5 text-2xs font-black text-primary hover:bg-primary/10">
          {aiLoading ? 'Analizuję…' : aiQuestions ? 'Zapytaj inaczej' : 'Pomóż mi pomyśleć'}
        </Pressable>
      </div>
      {aiQuestions ? (
        <div className="animate-in fade-in rounded-xl border border-border-custom bg-surface-solid p-3 text-xs font-semibold leading-relaxed text-text-primary whitespace-pre-line">{aiQuestions}</div>
      ) : (
        <p className="text-xs leading-relaxed text-text-secondary">Bez gotowych poleceń — tylko pytania, które pomagają nazwać własne priorytety.</p>
      )}
    </Card>
  );
}
