import React from "react";
import type { Session } from "@supabase/supabase-js";
import ProjectWeekKpis from "./ProjectWeekKpis";
import WeekPlanningRecap from "./WeekPlanningRecap";
import { useDirectionContext } from "./direction/hooks/useDirectionContext";
import { formatSprintWeekBridge } from "../../lib/goal/goalSpine";
import { formatSprintFromLongTerm } from "../../lib/goal/longTermBridge";

type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type Phase2Recap = {
  narrative_check: string;
  deepening_questions?: string[];
  block5_material?: { cialo: string; duch: string; konto: string };
};

type WeekFacts = {
  doneCount: number;
  totalCount: number;
  doneTasks: string[];
  droppedTasks: string[];
  sleepHrs: number | null;
  readiness: number | null;
  totalKm: number | null;
  avgKcal: number | null;
  targetKcal: number | null;
};

interface Props {
  session: Session;
  weekStart: string;
  planWeekStart: string;
  weekFacts: WeekFacts;
  phase1: Phase1Recap | null;
  phase1Loading: boolean;
  phase2: Phase2Recap | null;
  phase2Loading: boolean;
  prevWeekScores: { cialo?: number; duch?: number; konto?: number } | null;
  pillarScores: { cialo: number | null; duch: number | null; konto: number | null };
  setPillarScores: (s: { cialo: number | null; duch: number | null; konto: number | null }) => void;
  obligation: string;
  setObligation: (v: string) => void;
  doDifferently: string;
  setDoDifferently: (v: string) => void;
  proudOf: string;
  setProudOf: (v: string) => void;
  sabotage: string;
  setSabotage: (v: string) => void;
  weekHighlight: string;
  setWeekHighlight: (v: string) => void;
  weekRegret: string;
  setWeekRegret: (v: string) => void;
  newBelief: string;
  setNewBelief: (v: string) => void;
  deepeningAnswers: Record<string, string>;
  setDeepeningAnswers: (v: Record<string, string>) => void;
  weekIntention: string;
  setWeekIntention: (v: string) => void;
  weekCommitment: string;
  setWeekCommitment: (v: string) => void;
  weekGoalCialo: string;
  setWeekGoalCialo: (v: string) => void;
  weekGoalDuch: string;
  setWeekGoalDuch: (v: string) => void;
  weekGoalKonto: string;
  setWeekGoalKonto: (v: string) => void;
  saveReflection: () => void;
  savingReflection: boolean;
  onComplete: () => void;
  completing: boolean;
  reflectionSaved: boolean;
  activeProjects: { id: string; name: string }[];
  intentionFromMonth?: boolean;
  planCarriedFromMonth?: boolean;
}

function ScoreButton({
  value, current, onClick,
}: { value: number; current: number | null; onClick: () => void }) {
  const active = current === value;
  const activeColor =
    value <= 3 ? "bg-red-500 text-white border-red-500" :
    value <= 6 ? "bg-yellow-400 text-black border-yellow-400" :
    "bg-emerald-500 text-white border-emerald-500";
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full text-xs font-semibold border transition-all
        ${active
          ? `${activeColor} ring-2 ring-offset-1 ring-offset-surface-solid scale-110`
          : "border-border-custom bg-surface text-text-muted hover:bg-surface-solid"
        }`}
    >
      {value}
    </button>
  );
}

function PillarScoreRow({
  label, current, prev, onChange,
}: { label: string; current: number | null; prev: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">{label}</span>
        {prev != null && (
          <span className="text-[10px] text-text-muted">zeszły tydzień: {prev}</span>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {[1,2,3,4,5,6,7,8,9,10].map((v) => (
          <ScoreButton key={v} value={v} current={current} onClick={() => onChange(v)} />
        ))}
      </div>
    </div>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-[9px] uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 4,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm
        text-text-primary placeholder-text-muted resize-y min-h-[80px] focus:outline-none
        focus:border-primary/50 transition-colors"
    />
  );
}

function Q({ num, label, value, onChange, placeholder, rows = 4 }: {
  num: number; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary font-semibold">{num}. {label}</p>
      <Textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2.5 border border-border-custom">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function DirectionPlanningMode({
  session,
  weekStart,
  planWeekStart,
  weekFacts,
  phase1, phase1Loading,
  phase2, phase2Loading,
  prevWeekScores,
  pillarScores, setPillarScores,
  obligation, setObligation,
  doDifferently, setDoDifferently,
  proudOf, setProudOf,
  sabotage, setSabotage,
  weekHighlight, setWeekHighlight,
  weekRegret, setWeekRegret,
  newBelief, setNewBelief,
  deepeningAnswers, setDeepeningAnswers,
  weekIntention, setWeekIntention,
  weekCommitment, setWeekCommitment,
  weekGoalCialo, setWeekGoalCialo,
  weekGoalDuch, setWeekGoalDuch,
  weekGoalKonto, setWeekGoalKonto,
  saveReflection, savingReflection,
  onComplete, completing,
  reflectionSaved,
  activeProjects,
  intentionFromMonth = false,
  planCarriedFromMonth = false,
}: Props) {
  const direction = useDirectionContext(session.user.id, weekStart);
  const deepeningQuestions = phase2?.deepening_questions ?? [];
  const deepeningComplete =
    !phase2Loading &&
    (deepeningQuestions.length === 0
      ? reflectionSaved
      : deepeningQuestions.every((_, i) => (deepeningAnswers[String(i)] ?? '').trim().length > 0));

  const block5material = phase2?.block5_material;
  const weekStepDraft = weekIntention.trim() || weekCommitment.trim() || null;
  const sprintBridge = formatSprintWeekBridge(direction.sprintGoal, weekStepDraft);
  const longTermBridge = formatSprintFromLongTerm(direction.bhagLine ?? null, direction.sprintGoal);

  return (
    <div className="space-y-6 pb-8">

      <WeekPlanningRecap userId={session.user.id} weekStart={weekStart} />

      {/* ── BLOK 1: AI NARRACJA ─────────────────────────────────── */}
      <div className="space-y-3">
        <Divider title="Jak wyglądał twój tydzień" />

        {phase1Loading && (
          <div className="flex items-center gap-2 py-3 text-text-muted text-sm">
            <div className="w-3.5 h-3.5 border-2 border-border-custom border-t-primary rounded-full animate-spin" />
            AI analizuje tydzień…
          </div>
        )}

        {phase1 && (
          <div className="space-y-3">
            <p className="text-sm text-text-primary leading-relaxed">{phase1.narrative}</p>

            {phase1.longterm_motif && (
              <div className="border-l-2 border-amber-500 pl-3 py-1">
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-1">
                  Długoterminowy motyw
                </p>
                <p className="text-sm text-text-primary leading-relaxed">{phase1.longterm_motif}</p>
              </div>
            )}

            {phase1.question && (
              <div className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">
                  Pytanie otwierające
                </p>
                <p className="text-sm text-text-secondary italic">„{phase1.question}"</p>
              </div>
            )}
          </div>
        )}

        {!phase1Loading && !phase1 && (
          <p className="text-sm text-text-muted italic">AI podsumowanie pojawi się za chwilę…</p>
        )}
      </div>

      {/* ── BLOK 2: TYDZIEŃ W LICZBACH ──────────────────────────── */}
      <div className="space-y-4">
        <Divider title="Tydzień w liczbach" />
        
        {/* Unified Project KPIs edit block */}
        {activeProjects.length > 0 && (
          <div className="border border-border-custom bg-surface/30 rounded-xl p-3.5 space-y-2">
            <ProjectWeekKpis
              userId={session.user.id}
              projects={activeProjects}
              weekStart={weekStart}
              focusProjectIds={direction.sprintFocusProjectIds ?? []}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatCard value={String(weekFacts.doneCount)} label="zadań zrobionych" />
          <StatCard
            value={String(weekFacts.totalCount - weekFacts.doneCount)}
            label="niezrobionych"
          />
          {weekFacts.sleepHrs != null && (
            <StatCard value={weekFacts.sleepHrs.toFixed(1) + "h"} label="śr. sen" />
          )}
          {weekFacts.readiness != null && (
            <StatCard value={Math.round(weekFacts.readiness).toString()} label="śr. readiness" />
          )}
          {weekFacts.totalKm != null && weekFacts.totalKm > 0 && (
            <StatCard value={weekFacts.totalKm.toFixed(0) + "km"} label="łącznie (Strava)" />
          )}
          {weekFacts.avgKcal != null && (
            <StatCard
              value={Math.round(weekFacts.avgKcal).toString()}
              label={`śr. kcal${weekFacts.targetKcal ? ` / cel ${weekFacts.targetKcal}` : ""}`}
            />
          )}
        </div>

        {weekFacts.doneTasks.length > 0 && (
          <div className="space-y-1 mt-1">
            {weekFacts.doneTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>{t}</span>
              </div>
            ))}
            {weekFacts.droppedTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
                <span className="text-red-400 mt-0.5 shrink-0">↯</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BLOK 3: REFLEKSJA ────────────────────────────────────── */}
      <div className="space-y-4">
        <Divider title="Refleksja" />

        <Q num={1} label="Co musi zejść z głowy — zanim zacznę nowy tydzień?"
          value={obligation} onChange={setObligation}
          placeholder="Coś co ciągnie mnie w dół, wisi niedomknięte…" />
        <Q num={2} label="Gdzie zawiodłem siebie — kiedy poszedłem na łatwiznę?"
          value={doDifferently} onChange={setDoDifferently}
          placeholder="Konkretna sytuacja, moment…" />
        <Q num={3} label="Czego mi brakowało — kompetencji, zasobów, odwagi?"
          value={proudOf} onChange={setProudOf}
          placeholder="Co mi utrudniało życie w tym tygodniu…" />
        <Q num={4} label="Co unikałem — i co tak naprawdę za tym stoi?"
          value={sabotage} onChange={setSabotage}
          placeholder="Co odkładałem, od czego uciekałem…" />
        <Q num={5} label="Co dało mi energię / co zabrało?"
          value={weekHighlight} onChange={setWeekHighlight}
          placeholder="Momenty szczytowe i dolne tego tygodnia…" />
        <Q num={6} label="Czego żałuję — co bym cofnął?"
          value={weekRegret} onChange={setWeekRegret}
          placeholder="Decyzja, słowo, zaniechanie…" />
        <Q num={7} label="Co myślę inaczej niż tydzień temu?"
          value={newBelief} onChange={setNewBelief}
          placeholder="Nowe przekonanie, zmiana perspektywy…" />

        {/* Oceny filarów */}
        <div className="pt-3 space-y-4 border-t border-border-custom">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
            Oceny tygodnia (1–10)
          </p>
          <PillarScoreRow
            label="Ciało"
            current={pillarScores.cialo}
            prev={prevWeekScores?.cialo}
            onChange={(v) => setPillarScores({ ...pillarScores, cialo: v })}
          />
          <PillarScoreRow
            label="Duch"
            current={pillarScores.duch}
            prev={prevWeekScores?.duch}
            onChange={(v) => setPillarScores({ ...pillarScores, duch: v })}
          />
          <PillarScoreRow
            label="Konto"
            current={pillarScores.konto}
            prev={prevWeekScores?.konto}
            onChange={(v) => setPillarScores({ ...pillarScores, konto: v })}
          />
        </div>

        {!reflectionSaved ? (
          <button
            onClick={saveReflection}
            disabled={savingReflection}
            className="w-full py-2.5 rounded-xl border border-border-custom bg-surface
              hover:bg-surface-solid text-text-primary text-sm font-semibold
              transition-all disabled:opacity-40"
          >
            {savingReflection ? "Zapisuję…" : "Zapisz refleksję →"}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <span>✓</span>
            <span>Refleksja zapisana</span>
            {phase2Loading && (
              <span className="text-text-muted ml-1 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border border-border-custom border-t-primary rounded-full animate-spin" />
                AI generuje pytania…
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── BLOK 4: PYTANIA POGŁĘBIAJĄCE ────────────────────────── */}
      {reflectionSaved && (phase2 || phase2Loading) && (
        <div className="space-y-4">
          <Divider title="Zagłębmy się" />

          {phase2 && (
            <p className="text-sm text-text-primary leading-relaxed">{phase2.narrative_check}</p>
          )}

          {deepeningQuestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-[10px] text-text-muted font-medium">
                Odpowiedz na wszystkie {deepeningQuestions.length} żeby kontynuować
              </p>
              {deepeningQuestions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">{i + 1}. {q}</p>
                  <textarea
                    value={deepeningAnswers[String(i)] ?? ""}
                    onChange={(e) =>
                      setDeepeningAnswers({ ...deepeningAnswers, [String(i)]: e.target.value })
                    }
                    placeholder="Twoja odpowiedź…"
                    rows={2}
                    className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2
                      text-sm text-text-primary placeholder-text-muted resize-y min-h-[64px]
                      focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BLOK 5: PLAN ─────────────────────────────────────────── */}
      {reflectionSaved && (
        <div className={`space-y-4 transition-opacity duration-300 ${deepeningComplete ? "" : "opacity-30 pointer-events-none"}`}>
          <Divider title="Plan tygodnia" />

          {planWeekStart !== weekStart && (
            <p className="text-[10px] font-semibold text-text-muted">
              Cele zapiszą się na tydzień od {planWeekStart}
            </p>
          )}

          {block5material && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                Sugestie AI
              </p>
              {(direction.monthTheme || sprintBridge || longTermBridge) && (
                <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-3 py-2.5 space-y-1.5">
                  {longTermBridge && (
                    <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{longTermBridge}</p>
                  )}
                  {direction.monthTheme && (
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      <span className="font-black uppercase tracking-wider text-indigo-600 text-[9px]">
                        Temat miesiąca{direction.monthLabel ? ` · ${direction.monthLabel}` : ''}:{' '}
                      </span>
                      {direction.monthTheme}
                    </p>
                  )}
                  {sprintBridge && (
                    <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{sprintBridge}</p>
                  )}
                </div>
              )}
              {(["cialo", "duch", "konto"] as const).map((p) =>
                block5material[p] ? (
                  <div key={p} className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">
                      {p === "cialo" ? "Ciało" : p === "duch" ? "Duch" : "Konto"}
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">{block5material[p]}</p>
                  </div>
                ) : null
              )}
            </div>
          )}

          <div className="space-y-4">
            {(direction.monthTheme || direction.sprintGoal || direction.bhagLine) && (
              <div className="rounded-xl border border-border-custom bg-surface/50 px-3 py-2.5 space-y-1.5">
                {longTermBridge && (
                  <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{longTermBridge}</p>
                )}
                {direction.monthTheme && (
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    <span className="font-black uppercase tracking-wider text-indigo-600 text-[9px]">
                      Temat miesiąca{direction.monthLabel ? ` · ${direction.monthLabel}` : ''}:{' '}
                    </span>
                    {direction.monthTheme}
                  </p>
                )}
                {sprintBridge && (
                  <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{sprintBridge}</p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-text-muted font-medium">Intencja tygodnia — jaki chcę być?</p>
              {intentionFromMonth && weekIntention.trim() && (
                <p className="text-[10px] font-semibold text-indigo-600">
                  Wstępnie z tematu miesiąca — doprecyzuj pod ten tydzień.
                </p>
              )}
              <Textarea value={weekIntention} onChange={setWeekIntention}
                placeholder="Np. konsekwentny, spokojny, zdecydowany…" rows={2} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-text-muted font-medium">Zobowiązanie — co jest bezwzględne?</p>
              {planCarriedFromMonth && weekCommitment.trim() && (
                <p className="text-[10px] font-semibold text-indigo-600">
                  Z korekty miesiąca — jedna rzecz do poprawy w tym tygodniu.
                </p>
              )}
              <Textarea value={weekCommitment} onChange={setWeekCommitment}
                placeholder="Jedna rzecz której nie odpuszczę bez względu na wszystko…" rows={2} />
            </div>

            <div className="pt-3 space-y-3 border-t border-border-custom">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                3 duże cele na ten tydzień
              </p>
              {planCarriedFromMonth && (
                <p className="text-[10px] font-semibold text-indigo-600">
                  Cele filarów wstępnie z przeglądu miesiąca (korekta / dźwignia).
                </p>
              )}
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-medium">Ciało</p>
                <Textarea value={weekGoalCialo} onChange={setWeekGoalCialo}
                  placeholder="Jeden konkretny cel fizyczny…" rows={2} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-medium">Duch</p>
                <Textarea value={weekGoalDuch} onChange={setWeekGoalDuch}
                  placeholder="Jeden konkretny cel mentalny / relacyjny…" rows={2} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted font-medium">Konto</p>
                <Textarea value={weekGoalKonto} onChange={setWeekGoalKonto}
                  placeholder="Jeden konkretny cel finansowy / zawodowy…" rows={2} />
              </div>
            </div>

            <button
              onClick={onComplete}
              disabled={completing || !deepeningComplete}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold
                hover:opacity-90 transition-all disabled:opacity-30"
            >
              {completing ? "Zamykam tydzień…" : "Zakończ przegląd tygodnia"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
