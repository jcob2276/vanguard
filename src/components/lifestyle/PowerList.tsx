import { getTodayWarsaw } from '../../lib/date';
import { useEffect, useRef, useState } from 'react';
import { useHaptics } from '../../hooks/useHaptics';
import { supabase } from '../../lib/supabase';
import { Check, Link2, Search, Shield, Target, Upload, Wallet, X, Zap, Sparkles } from 'lucide-react';
import { listTodoItems, listTodoSections, updateTodoItem } from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import type { TablesUpdate } from '../../lib/database.types';
import { gatherUserContext } from '../../lib/aiContext';

const SPHERE_SLOTS = [
  { category: 'cialo', label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', placeholder: 'Priorytet Ciało — co dziś?' },
  { category: 'duch',  label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  placeholder: 'Priorytet Duch — co dziś?'  },
  { category: 'konto', label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   placeholder: 'Priorytet Konto — co dziś?' },
];

const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high: 'bg-indigo-500',
  urgent: 'bg-rose-500',
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

interface TodoPickerProps {
  items: any[];
  onSelect: (item: any) => void;
  onClose: () => void;
}

function TodoPicker({ items, onSelect, onClose }: TodoPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2">
        <Search size={11} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania..."
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[188px] overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[10px] font-medium text-text-muted">Brak otwartych zadań</p>
        ) : (
          filtered.slice(0, 20).map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[0.98]"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-blue-500'}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{item.title}</span>
              {item.due_date && (
                <span className="shrink-0 text-[9px] font-bold text-text-muted">{item.due_date}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PowerList({ session, todayWin, onUpdate }: { session: any; todayWin: any; onUpdate?: (data: any) => void }) {
  const userId = session.user.id;
  const today = getTodayWarsaw();
  const haptics = useHaptics();

  const [projectMap, setProjectMap] = useState<Record<string, { name: string; color: string | null }>>({});

  const [newTaskForm, setNewTaskForm] = useState<Array<{ task: string; todoId: string | null }>>([
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
  ]);
  const [todoItems, setTodoItems] = useState<any[]>([]);
  const [pickerSlot, setPickerSlot] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // AI assistant states
  const [aiStep, setAiStep] = useState<'idle' | 'questions' | 'wins'>('idle');
  const [aiQuestions, setAiQuestions] = useState<string>('');
  const [aiAnswersInput, setAiAnswersInput] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ category: string; task: string; reason?: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  async function generateQuestions() {
    setAiLoading(true);
    try {
      const stateVector = await gatherUserContext(session);
      const query = `Zanalizuj mój kontekst życiowy, kalendarza i zadania. Zadaj mi 3-4 krótkie, bezpośrednie i bardzo trafne pytania, które naprowadzą mnie na zdefiniowanie 5 zwycięstw na dziś (Ciało, Duch, Konto + 2 ogólne).
Pytania muszą celować w moje najważniejsze wyzwania i to, co mogę dziś pchnąć do przodu (np. nawiązując do konkretnych zadań z todo lub kalendarza).
Zwróć TYLKO wypunktowaną listę 3-4 pytań w polu "answer", bez żadnego wstępu, powitań czy komentarzy.`;

      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: [],
          current_query: query,
          user_id: userId,
          mode: 'chat',
        },
      });

      if (error) throw error;
      const reply = data?.text ?? data?.answer ?? '';
      setAiQuestions(reply);
      setAiStep('questions');
    } catch (e: any) {
      console.error('generateQuestions failed', e);
      alert('Błąd pomocy AI: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function generateWins() {
    if (!aiAnswersInput.trim()) {
      alert('Wpisz chociaż krótkie odpowiedzi lub wskazówki!');
      return;
    }
    setAiLoading(true);
    try {
      const stateVector = await gatherUserContext(session);
      const prompt = `Oto moje odpowiedzi na Twoje pytania pomocnicze:
"${aiAnswersInput}"

Na ich podstawie oraz mojego kontekstu, zasugeruj mi 5 zwycięstw na dziś (Ciało, Duch, Konto i 2 ogólne).
Odpowiedz wyłącznie w postaci tablicy JSON w polu "answer", bez żadnych dodatkowych zdań na początku ani na końcu.
Format pola "answer" musi być poprawnym JSON-em o strukturze:
[
  {"category": "cialo", "task": "fizyczna akcja na dziś", "reason": "krótkie uzasadnienie"},
  {"category": "duch", "task": "fizyczna akcja na dziś", "reason": "krótkie uzasadnienie"},
  {"category": "konto", "task": "fizyczna akcja na dziś", "reason": "krótkie uzasadnienie"},
  {"category": "ogolne", "task": "fizyczna akcja na dziś", "reason": "krótkie uzasadnienie"},
  {"category": "ogolne", "task": "fizyczna akcja na dziś", "reason": "krótkie uzasadnienie"}
]
Zadania muszą być konkretnymi ruchami fizycznymi na dziś.`;

      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: [
            { role: 'assistant', content: aiQuestions },
            { role: 'user', content: aiAnswersInput }
          ],
          current_query: prompt,
          user_id: userId,
          mode: 'chat',
        },
      });

      if (error) throw error;
      const reply = data?.text ?? data?.answer ?? '';
      let parsed: any[] = [];
      try {
        parsed = JSON.parse(reply);
      } catch {
        const match = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e) {
            console.warn('JSON parse match failed', e);
          }
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        setAiSuggestions(parsed);
        setAiStep('wins');
      } else {
        alert('Nie udało się sformatować sugestii. Odpowiedź AI:\n' + reply);
      }
    } catch (e: any) {
      console.error('generateWins failed', e);
      alert('Błąd generowania zwycięstw: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  const applySuggestion = (task: string, category: string) => {
    let slotIdx: number;
    if (category === 'cialo') {
      slotIdx = 0;
    } else if (category === 'duch') {
      slotIdx = 1;
    } else if (category === 'konto') {
      slotIdx = 2;
    } else if (!newTaskForm[3].task) {
      slotIdx = 3;
    } else if (!newTaskForm[4].task) {
      slotIdx = 4;
    } else {
      slotIdx = 3;
    }
    updateSlot(slotIdx, { task });
  };

  // Resolve projects for today's linked todo items
  useEffect(() => {
    const ids = [
      todayWin?.task_1_todo_id,
      todayWin?.task_2_todo_id,
      todayWin?.task_3_todo_id,
      todayWin?.task_4_todo_id,
      todayWin?.task_5_todo_id,
    ].filter((id): id is string => !!id);
    if (ids.length === 0) return;
    (async () => {
      try {
        const [{ data: items }, sections, projects] = await Promise.all([
          supabase.from('todo_items').select('id, section_id').in('id', ids),
          listTodoSections(userId),
          listProjects(userId),
        ]);
        const sectionMap = new Map((sections ?? []).map((s: any) => [s.id, s]));
        const projectData = new Map((projects ?? []).map((p: any) => [p.id, p]));
        const result: Record<string, { name: string; color: string | null }> = {};
        for (const item of items ?? []) {
          const section = sectionMap.get(item.section_id) as any;
          const project = section?.project_id ? projectData.get(section.project_id) as any : null;
          if (project) result[item.id] = { name: project.name, color: project.color };
        }
        setProjectMap(result);
      } catch { /* project lookup is decorative, ignore */ }
    })();
  }, [todayWin?.task_1_todo_id, todayWin?.task_2_todo_id, todayWin?.task_3_todo_id, todayWin?.task_4_todo_id, todayWin?.task_5_todo_id, userId]);

  useEffect(() => {
    if (todayWin) return;
    listTodoItems(userId)
      .then((items) => {
        const open = (items || [])
          .filter((i) => i.status === 'open')
          .sort((a, b) => {
            const aToday = a.due_date === today;
            const bToday = b.due_date === today;
            if (aToday !== bToday) return aToday ? -1 : 1;
            return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          });
        setTodoItems(open);
      })
      .catch(() => {});
  }, [userId, today, todayWin]);

  useEffect(() => {
    if (pickerSlot < 0) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerSlot(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerSlot]);

  const updateSlot = (i: number, patch: Partial<{ task: string; todoId: string | null }>) => {
    setNewTaskForm((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...patch };
      return n;
    });
  };

  async function toggleTask(index: number) {
    if (!todayWin) return;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const todoIdField = `task_${index + 1}_todo_id`;
    const newValue = !todayWin[field];
    const timestamp = newValue ? new Date().toISOString() : null;

    const allDone = [1, 2, 3, 4, 5].every((i) => {
      if (!todayWin[`task_${i}`]) return true;
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { [field]: newValue, [timeField]: timestamp } as TablesUpdate<'daily_wins'>;
    if (allDone) updates.result = 'Z';
    else {
      if (todayWin.result === 'Z') updates.result = null;
      if (new Date().getHours() >= 23 && !allDone) updates.result = 'P';
    }

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', todayWin.id)
      .select()
      .single();

    if (!error) {
      if (newValue) haptics.success(); else haptics.light();
      if (onUpdate) onUpdate(data);

      if (newValue) {
        const taskText = todayWin[`task_${index + 1}`];
        const category = todayWin[`category_${index + 1}`] ?? 'general';
        if (taskText) {
          supabase.from('vanguard_stream').insert({
            user_id: userId,
            source: 'powerlist',
            content: `Powerlist ✓ [${category}]: ${taskText}`,
            metadata: { category, index: index + 1, todo_id: todayWin[todoIdField] ?? null },
          } as any).then(() => {}, () => {});
        }
      }
    }

    const linkedTodoId = todayWin[todoIdField];
    if (linkedTodoId) {
      updateTodoItem(linkedTodoId, {
        status: newValue ? 'done' : 'open',
        completed_at: newValue ? new Date().toISOString() : null,
      }).catch(() => {});
    }
  }

  async function startNewDay() {
    if (submitting) return;
    if (!newTaskForm.some((t) => t.task.trim())) {
      alert('Wypełnij przynajmniej 1 zadanie!');
      return;
    }

    setSubmitting(true);
    try {
      const entry = {
        user_id: userId,
        date: today,
        task_1: newTaskForm[0].task, category_1: 'cialo', task_1_todo_id: newTaskForm[0].todoId,
        task_2: newTaskForm[1].task, category_2: 'duch',  task_2_todo_id: newTaskForm[1].todoId,
        task_3: newTaskForm[2].task, category_3: 'konto', task_3_todo_id: newTaskForm[2].todoId,
        task_4: newTaskForm[3].task, category_4: 'general', task_4_todo_id: newTaskForm[3].todoId,
        task_5: newTaskForm[4].task, category_5: 'general', task_5_todo_id: newTaskForm[4].todoId,
        result: null,
      };

      const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
      if (error) {
        console.error('[startNewDay]', error);
        haptics.error();
        alert('Błąd startu dnia');
      } else {
        haptics.success();
        if (onUpdate) onUpdate(data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' && (
          <div className="rounded-full border border-dayC/15 bg-dayC/10 px-2.5 py-0.5 font-display text-[9px] font-bold text-dayC">
            Dzień wygrany
          </div>
        )}
      </div>

      {!todayWin ? (
        <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
          <div>
            <h3 className="font-display text-[14px] font-black tracking-tight text-text-primary">
              Zdefiniuj 5 zwycięstw
            </h3>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">
              Wpisz ręcznie lub wybierz z{' '}
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                Zadań <Link2 size={10} />
              </span>
              .
            </p>
          </div>

          {/* AI Helper Section */}
          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-3.5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
                <Sparkles size={12} className="animate-pulse" /> Asystent AI
              </span>
              {aiStep === 'idle' && (
                <button
                  type="button"
                  onClick={generateQuestions}
                  disabled={aiLoading}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/10 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {aiLoading ? 'Analizowanie...' : '❓ Zadaj mi pytania'}
                </button>
              )}
              {aiStep !== 'idle' && (
                <button
                  type="button"
                  onClick={() => {
                    setAiStep('idle');
                    setAiQuestions('');
                    setAiAnswersInput('');
                    setAiSuggestions([]);
                  }}
                  className="text-[9px] font-bold text-text-muted hover:text-text-primary cursor-pointer border-none bg-transparent"
                >
                  Zacznij od nowa
                </button>
              )}
            </div>

            {/* Step 1: Display Questions + Answers Textarea */}
            {aiStep === 'questions' && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="rounded-lg border border-border-custom bg-surface p-3 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5 font-display">Pytania pomocnicze:</p>
                  <div className="text-[11px] font-semibold text-text-primary leading-relaxed whitespace-pre-line">
                    {aiQuestions}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted font-display">Twoje odpowiedzi / notatki:</p>
                  <textarea
                    value={aiAnswersInput}
                    onChange={(e) => setAiAnswersInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="Wpisz krótkie odpowiedzi (np. 'siłownia wieczorem, duch: przeczytać książkę, konto: wysłać oferty')"
                    className="w-full min-h-[70px] rounded-lg border border-border-custom bg-transparent p-2.5 text-[11px] font-medium text-text-primary placeholder:text-text-muted/40 outline-none focus:border-primary/40 focus:bg-surface-solid resize-none"
                  />
                  <button
                    type="button"
                    onClick={generateWins}
                    disabled={aiLoading || !aiAnswersInput.trim()}
                    className="w-full rounded-lg bg-primary py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary-hover active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {aiLoading ? 'Generowanie...' : '✨ Wygeneruj 5 zwycięstw'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Display Win Suggestions with Użyj button */}
            {aiStep === 'wins' && (
              <div className="space-y-3.5 animate-in fade-in duration-300">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted font-display">Zaproponowane zwycięstwa:</p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {aiSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="rounded-lg border border-border-custom bg-surface p-2.5 text-left transition-all hover:border-primary/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block rounded bg-primary/10 px-1 py-0.5 text-[7px] font-black uppercase tracking-wider text-primary mb-1">
                            {suggestion.category}
                          </span>
                          <p className="text-[11px] font-semibold text-text-primary leading-tight">
                            {suggestion.task}
                          </p>
                          {suggestion.reason && (
                            <p className="mt-0.5 text-[9px] font-medium text-text-muted leading-snug">
                              {suggestion.reason}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => applySuggestion(suggestion.task, suggestion.category)}
                          className="shrink-0 rounded bg-primary px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider text-white hover:bg-primary-hover active:scale-95 cursor-pointer"
                        >
                          Użyj
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5" ref={pickerRef}>
            {newTaskForm.map((slot, i) => {
              const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
              const SphereIcon = sphere?.icon;
              return (
                <div key={i}>
                  <div
                    className={`flex items-center gap-2 rounded-xl border bg-surface transition-colors ${
                      pickerSlot === i ? 'border-primary/40 bg-surface-solid' : 'border-border-custom'
                    }`}
                  >
                    {/* Sphere badge for slots 0-2 */}
                    {sphere && SphereIcon && (
                      <span className={`ml-3 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                        <SphereIcon size={8} /> {sphere.label}
                      </span>
                    )}

                    {slot.todoId ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[todoItems.find((x) => x.id === slot.todoId)?.priority] || 'bg-blue-500'}`} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{slot.task}</span>
                      </div>
                    ) : (
                      <input
                        placeholder={sphere?.placeholder ?? `Zadanie ${i + 1}`}
                        value={slot.task}
                        onChange={(e) => updateSlot(i, { task: e.target.value })}
                        className={`min-w-0 flex-1 bg-transparent py-3 text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted/40 ${sphere ? 'px-2' : 'px-3.5'}`}
                      />
                    )}

                    {slot.todoId ? (
                      <button onClick={() => updateSlot(i, { task: '', todoId: null })}
                        className="mr-3 shrink-0 rounded-full p-1.5 text-primary transition-colors hover:bg-rose-500/10 hover:text-rose-500" title="Usuń powiązanie">
                        <X size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setPickerSlot(pickerSlot === i ? -1 : i)}
                        className={`mr-3 shrink-0 rounded-full p-1.5 transition-colors ${pickerSlot === i ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`}
                        title="Wybierz z zadań">
                        <Link2 size={14} />
                      </button>
                    )}
                  </div>

                  {pickerSlot === i && (
                    <TodoPicker
                      items={todoItems.filter(item => !newTaskForm.some((slot, idx) => idx !== i && slot.todoId === item.id))}
                      onSelect={(item) => updateSlot(i, { task: item.title, todoId: item.id })}
                      onClose={() => setPickerSlot(-1)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={startNewDay}
            disabled={submitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} /> {submitting ? 'Zapisywanie…' : 'Zacznij dzień'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => {
            const task = todayWin[`task_${i + 1}`];
            const done = todayWin[`done_${i + 1}`];
            const completedAt = todayWin[`completed_at_${i + 1}`];
            const linkedTodoId = todayWin[`task_${i + 1}_todo_id`];
            if (!task) return null;

            const sphere = i < 3 ? SPHERE_SLOTS[i] : null;
            const SphereIcon = sphere?.icon;

            return (
              <button
                key={i}
                onClick={() => toggleTask(i)}
                className={`group flex w-full cursor-pointer items-center justify-between rounded-[24px] border p-4 transition-all duration-200 active:scale-[0.98] ${
                  done
                    ? 'border-border-custom bg-surface/30 opacity-60 shadow-none'
                    : 'border-border-custom bg-surface shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-solid hover:shadow-md'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div
                    className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      done
                        ? 'border-dayC bg-dayC text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] scale-100'
                        : 'border-border-custom bg-surface-solid text-transparent scale-95 group-hover:border-primary/40 group-active:scale-90'
                    }`}
                  >
                    <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${done ? 'scale-100' : 'scale-0'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sphere && SphereIcon && (
                        <span className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-black uppercase tracking-widest ${sphere.bg} ${sphere.text}`}>
                          <SphereIcon size={7} /> {sphere.label}
                        </span>
                      )}
                      <p className={`text-[13px] font-semibold tracking-normal transition-all duration-300 ${done ? 'text-text-muted line-through opacity-70' : 'text-text-primary'}`}>
                        {task}
                      </p>
                    </div>
                    {done && completedAt && (
                      <p className="mt-0.5 text-[9px] font-semibold text-dayC/80">
                        Zrobione o {new Date(completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                {linkedTodoId && (() => {
                  const proj = projectMap[linkedTodoId];
                  return proj ? (
                    <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
                      <span className={`h-1.5 w-1.5 rounded-full ${COLOR_DOT[proj.color || ''] || 'bg-primary'}`} />
                      {proj.name}
                    </span>
                  ) : !done ? (
                    <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
                      <Link2 size={8} /> Zadanie
                    </span>
                  ) : null;
                })()}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
