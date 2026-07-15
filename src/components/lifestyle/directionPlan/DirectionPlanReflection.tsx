import { Pressable, ControlTextarea } from '../../ui/ControlPrimitives';
import Spinner from '../../ui/Spinner';

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-2xs uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <ControlTextarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-y min-h-[var(--ds-h-80px)] focus:outline-none focus:border-primary/50 transition-colors" />
  );
}

function Q({ num, label, value, onChange, placeholder, rows = 4 }: {
  num: number; label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary font-semibold">{num}. {label}</p>
      <Textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
    </div>
  );
}

function ScoreButton({ value, current, onClick }: { value: number; current: number | null; onClick: () => void }) {
  const active = current === value;
  const activeColor = value <= 3 ? "bg-danger text-on-accent border-danger" : value <= 6 ? "bg-warning text-scrim border-warning" : "bg-success text-on-accent border-success";
  return (
    <Pressable onClick={onClick}
      className={`w-8 h-8 rounded-full text-xs font-semibold border transition-all ${active ? `${activeColor} ring-2 ring-offset-1 ring-offset-surface-solid scale-110` : "border-border-custom bg-surface text-text-muted hover:bg-surface-solid"}`}>
      {value}
    </Pressable>
  );
}

function PillarScoreRow({ label, current, prev, onChange }: { label: string; current: number | null; prev: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">{label}</span>
        {prev != null && <span className="text-xs text-text-muted">zeszły tydzień: {prev}</span>}
      </div>
      <div className="flex gap-1 flex-wrap">
        {[1,2,3,4,5,6,7,8,9,10].map((v) => (
          <ScoreButton key={v} value={v} current={current} onClick={() => onChange(v)} />
        ))}
      </div>
    </div>
  );
}

interface DirectionPlanReflectionProps {
  obligation: string; setObligation: (v: string) => void;
  doDifferently: string; setDoDifferently: (v: string) => void;
  proudOf: string; setProudOf: (v: string) => void;
  sabotage: string; setSabotage: (v: string) => void;
  weekHighlight: string; setWeekHighlight: (v: string) => void;
  weekRegret: string; setWeekRegret: (v: string) => void;
  newBelief: string; setNewBelief: (v: string) => void;
  pillarScores: { cialo: number | null; duch: number | null; konto: number | null };
  setPillarScores: (s: { cialo: number | null; duch: number | null; konto: number | null }) => void;
  prevWeekScores: { cialo?: number; duch?: number; konto?: number } | null;
  saveReflection: () => void;
  savingReflection: boolean;
  reflectionSaved: boolean;
  phase2Loading: boolean;
}

export default function DirectionPlanReflection(props: DirectionPlanReflectionProps) {
  return (
    <div className="space-y-4">
      <Divider title="Refleksja" />
      <Q num={1} label="Co musi zejść z głowy — zanim zacznę nowy tydzień?" value={props.obligation} onChange={props.setObligation} placeholder="Coś co ciągnie mnie w dół, wisi niedomknięte…" />
      <Q num={2} label="Gdzie zawiodłem siebie — kiedy poszedłem na łatwiznę?" value={props.doDifferently} onChange={props.setDoDifferently} placeholder="Konkretna sytuacja, moment…" />
      <Q num={3} label="Czego mi brakowało — kompetencji, zasobów, odwagi?" value={props.proudOf} onChange={props.setProudOf} placeholder="Co mi utrudniało życie w tym tygodniu…" />
      <Q num={4} label="Co unikałem — i co tak naprawdę za tym stoi?" value={props.sabotage} onChange={props.setSabotage} placeholder="Co odkładałem, od czego uciekałem…" />
      <Q num={5} label="Co dało mi energię / co zabrało?" value={props.weekHighlight} onChange={props.setWeekHighlight} placeholder="Momenty szczytowe i dolne tego tygodnia…" />
      <Q num={6} label="Czego żałuję — co bym cofnął?" value={props.weekRegret} onChange={props.setWeekRegret} placeholder="Decyzja, słowo, zaniechanie…" />
      <Q num={7} label="Co myślę inaczej niż tydzień temu?" value={props.newBelief} onChange={props.setNewBelief} placeholder="Nowe przekonanie, zmiana perspektywy…" />
      <div className="pt-3 space-y-4 border-t border-border-custom">
        <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Oceny tygodnia (1–10)</p>
        <PillarScoreRow label="Ciało" current={props.pillarScores.cialo} prev={props.prevWeekScores?.cialo} onChange={(v) => props.setPillarScores({ ...props.pillarScores, cialo: v })} />
        <PillarScoreRow label="Duch" current={props.pillarScores.duch} prev={props.prevWeekScores?.duch} onChange={(v) => props.setPillarScores({ ...props.pillarScores, duch: v })} />
        <PillarScoreRow label="Konto" current={props.pillarScores.konto} prev={props.prevWeekScores?.konto} onChange={(v) => props.setPillarScores({ ...props.pillarScores, konto: v })} />
      </div>
      {!props.reflectionSaved ? (
        <Pressable onClick={props.saveReflection} disabled={props.savingReflection}
          className="w-full py-2.5 rounded-xl border border-border-custom bg-surface hover:bg-surface-solid text-text-primary text-sm font-semibold transition-all disabled:opacity-[var(--opacity-40)]">
          {props.savingReflection ? "Zapisuję…" : "Zapisz refleksję →"}
        </Pressable>
      ) : (
        <div className="flex items-center gap-2 text-xs text-success dark:text-success">
          <span>✓</span><span>Refleksja zapisana</span>
          {props.phase2Loading && (
            <span className="text-text-muted ml-1 flex items-center gap-1"><Spinner size="sm" />AI generuje pytania…</span>
          )}
        </div>
      )}
    </div>
  );
}
