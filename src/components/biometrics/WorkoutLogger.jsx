import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, ChevronLeft, Save, Dumbbell, Zap, ChevronDown, ChevronUp, Clock, Play, Square, Trophy, X } from 'lucide-react';

import { EXERCISES, ALL_TAGS, tagClass, normalize } from '../../data/exercises';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newSet      = () => ({ id: Date.now() + Math.random(), kg: '', reps: '', rir: '', msp: false });
const newExercise = () => ({ id: Date.now() + Math.random(), name: '', tags: [], sets: [newSet()] });
const newActivity = () => ({ id: Date.now() + Math.random(), name: '', min: '', note: '' });

const numInput = "h-11 w-full bg-surface border border-border-custom rounded-xl text-sm font-black text-text-primary text-center outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_2px_rgba(79,70,229,0.08)] transition-all placeholder:text-text-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";


function epley(kg, reps) {
  const k = parseFloat(kg), r = parseInt(reps);
  if (!k || !r || r <= 0) return null;
  return r === 1 ? k : k * (1 + r / 30);
}

function useStopwatch(startTs) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTs) return;
    setElapsed(Math.floor((Date.now() - startTs) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTs]);
  if (!startTs) return null;
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function useExerciseHistory(name, userId) {
  const [lastSession, setLastSession]     = useState(null);
  const [allTimeBest1RM, setAllTimeBest1RM] = useState(null);

  useEffect(() => {
    const trimmed = name.trim();
    if (!userId || trimmed.length < 2) { setLastSession(null); setAllTimeBest1RM(null); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('exercise_logs')
        .select('weight, reps, rir, set_number, session_id, workout_sessions!inner(date)')
        .eq('user_id', userId)
        .eq('exercise_name', trimmed)
        .limit(500);

      if (!data?.length) { setLastSession(null); setAllTimeBest1RM(null); return; }

      const sorted = [...data].sort((a, b) => {
        const byDate = (b.workout_sessions?.date || '').localeCompare(a.workout_sessions?.date || '');
        return byDate || (a.set_number || 0) - (b.set_number || 0);
      });
      const bySession = {};
      for (const row of sorted) {
        if (!bySession[row.session_id]) bySession[row.session_id] = [];
        bySession[row.session_id].push(row);
      }
      const last = Object.values(bySession)[0].sort((a, b) => a.set_number - b.set_number);
      setLastSession(last);

      const best = sorted.reduce((max, r) => { const e = epley(r.weight, r.reps); return e && e > max ? e : max; }, 0);
      setAllTimeBest1RM(best > 0 ? best : null);
    }, 500);
    return () => clearTimeout(timeout);
  }, [name, userId]);

  return { lastSession, allTimeBest1RM };
}

function formatLastSession(sets) {
  if (!sets?.length) return null;
  const ws = [...new Set(sets.map(s => s.weight))];
  const rs = [...new Set(sets.map(s => s.reps))];
  if (ws.length === 1 && rs.length === 1) return `${ws[0]}kg × ${rs[0]} × ${sets.length} ser.`;
  return sets.map(s => `${s.weight}×${s.reps}`).join(' · ');
}

// ─── Autocomplete input ───────────────────────────────────────────────────────

function ExerciseNameInput({ value, tags, onChange }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Sync external value → local query (e.g. on reset)
  useEffect(() => { setQuery(value); }, [value]);

  const matches = query.trim().length === 0 ? [] :
    EXERCISES.filter(e => normalize(e.name).includes(normalize(query))).slice(0, 8);

  function select(ex) {
    setQuery(ex.name);
    onChange(ex.name, ex.tags);
    setOpen(false);
  }

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    onChange(v, tags); // keep existing tags when typing freely
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nazwa ćwiczenia..."
        className="w-full bg-transparent text-sm font-bold text-text-primary outline-none placeholder:text-text-muted/40"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border-custom bg-surface-solid shadow-lg overflow-hidden">
          {matches.map(ex => (
            <button
              key={ex.name}
              onMouseDown={() => select(ex)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-text-primary/[0.04] transition-colors gap-3"
            >
              <span className="text-sm text-text-primary font-medium">{ex.name}</span>
              <div className="flex gap-1 shrink-0">
                {ex.tags.slice(0, 3).map(t => (
                  <span key={t} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${tagClass(t)}`}>{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tag editor ───────────────────────────────────────────────────────────────

function TagRow({ tags, onChange }) {
  const [picking, setPicking] = useState(false);
  const available = ALL_TAGS.filter(t => !tags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
      {tags.map(t => (
        <button
          key={t}
          onClick={() => onChange(tags.filter(x => x !== t))}
          className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(t)} transition-opacity hover:opacity-70`}
        >
          {t} <X size={8} />
        </button>
      ))}
      {available.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setPicking(p => !p)}
            onBlur={() => setTimeout(() => setPicking(false), 150)}
            className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-dashed border-border-custom text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer"
          >
            + tag
          </button>
          {picking && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl border border-border-custom bg-surface-solid shadow-lg p-2 flex flex-wrap gap-1 w-52">
              {available.map(t => (
                <button
                  key={t}
                  onMouseDown={() => { onChange([...tags, t]); setPicking(false); }}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(t)} hover:opacity-80 transition-opacity`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Volume by muscle tag ─────────────────────────────────────────────────────

function VolumeBar({ exercises }) {
  const vol = {};
  exercises.forEach(ex => {
    const exVol = (ex.sets ?? []).reduce((sum, s) => {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps) || 0;
      return sum + kg * reps;
    }, 0);
    if (exVol > 0) {
      (ex.tags ?? []).forEach(tag => { vol[tag] = (vol[tag] || 0) + exVol; });
    }
  });
  const entries = Object.entries(vol).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="rounded-2xl border border-border-custom bg-surface/40 backdrop-blur-md px-4 py-3 shadow-sm">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted block mb-2">Objętość sesji</span>
      <div className="flex flex-wrap gap-2">
        {entries.map(([tag, v]) => (
          <div key={tag} className="flex items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tagClass(tag)}`}>{tag}</span>
            <span className="text-[10px] font-bold text-text-secondary">{Math.round(v).toLocaleString()}kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Progressive overload suggestion ─────────────────────────────────────────

function getSuggestion(lastSession) {
  if (!lastSession?.length) return null;
  const maxW = Math.max(...lastSession.map(s => s.weight));
  if (!maxW) return null;
  const minReps = Math.min(...lastSession.map(s => s.reps));
  const maxReps = Math.max(...lastSession.map(s => s.reps));
  const repsConsistent = (maxReps - minReps) <= 1;
  const increment = maxW >= 40 ? 2.5 : 1.25;

  if (!repsConsistent) return maxW;

  const rirValues = lastSession.map(s => s.rir).filter(r => r != null && r !== '');
  const avgRir = rirValues.length > 0
    ? rirValues.reduce((a, b) => a + parseFloat(b), 0) / rirValues.length
    : null;

  // RIR 0 — failed/near-failure, don't increase
  if (avgRir !== null && avgRir < 1) return maxW;
  return maxW + increment;
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onChange, onRemove, userId }) {
  const [collapsed, setCollapsed] = useState(false);
  const sets = exercise.sets ?? [];
  const tags = exercise.tags ?? [];
  const { lastSession, allTimeBest1RM } = useExerciseHistory(exercise.name ?? '', userId);

  function addSet() {
    const last = sets[sets.length - 1];
    onChange({ ...exercise, sets: [...exercise.sets, { ...newSet(), kg: last.kg, reps: last.reps, rir: last.rir }] });
  }
  function removeSet(id) {
    if (sets.length <= 1) return;
    onChange({ ...exercise, sets: sets.filter(s => s.id !== id) });
  }
  function updateSet(id, field, value) {
    onChange({ ...exercise, sets: sets.map(s => s.id === id ? { ...s, [field]: value } : s) });
  }

  const current1RM = sets.reduce((best, s) => { const e = epley(s.kg, s.reps); return e && e > best ? e : best; }, 0);

  return (
    <div className="rounded-2xl border border-border-custom bg-surface/40 backdrop-blur-md overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-custom bg-text-primary/[0.01]">
        <ExerciseNameInput
          value={exercise.name}
          tags={exercise.tags}
          onChange={(name, tags) => onChange({ ...exercise, name, tags })}
        />
        <button onClick={() => setCollapsed(c => !c)} className="p-1 text-text-secondary hover:text-text-primary transition-colors">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-text-muted hover:text-rose-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tags */}
      {(tags.length > 0 || (exercise.name ?? '').trim().length > 0) && (
        <TagRow tags={tags} onChange={t => onChange({ ...exercise, tags: t })} />
      )}

      {/* Ostatnio + sugestia */}
      {lastSession && (
        <div className="px-4 py-1.5 border-t border-border-custom bg-text-primary/[0.01] flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Ostatnio</span>
          <span className="text-[10px] font-bold text-text-secondary">{formatLastSession(lastSession)}</span>
          {(() => {
            const s = getSuggestion(lastSession);
            const lastW = Math.max(...lastSession.map(x => x.weight));
            const progressed = s > lastW;
            return s ? (
              <span className={`ml-auto text-[10px] font-black ${progressed ? 'text-emerald-500' : 'text-text-secondary'}`}>
                → {s}kg{progressed ? ' ↑' : ''}
              </span>
            ) : null;
          })()}
        </div>
      )}

      {/* Sets */}
      {!collapsed && (
        <div className="px-4 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-2 px-0.5">
            <span />
            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">KG</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">Pow.</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted text-center">RIR</span>
            <span />
          </div>

          {exercise.sets.map((set, idx) => {
            const set1RM = epley(set.kg, set.reps);
            const isPR = set1RM && allTimeBest1RM && set1RM > allTimeBest1RM;

            const adjustValue = (field, step, isInt = false) => {
              const currentVal = parseFloat(set[field]);
              if (isNaN(currentVal)) {
                if (field === 'kg') updateSet(set.id, field, '40');
                else if (field === 'reps') updateSet(set.id, field, '8');
                else if (field === 'rir') updateSet(set.id, field, '2');
              } else {
                const nextVal = currentVal + step;
                if (nextVal >= 0) {
                  updateSet(set.id, field, isInt ? Math.round(nextVal).toString() : nextVal.toString());
                }
              }
            };

            return (
              <div key={set.id} className="grid grid-cols-[20px_1fr_1fr_1fr_24px] gap-1.5 items-center">
                <button
                  onClick={() => updateSet(set.id, 'msp', !set.msp)}
                  title="Oznacz jako MSP (kluczowy set)"
                  className={`text-[10px] font-black text-center w-5 h-5 rounded-full transition-colors ${set.msp ? 'text-amber-500' : 'text-text-secondary hover:text-text-primary'}`}
                >{set.msp ? '★' : idx + 1}</button>
                
                {/* KG Column */}
                <div className="flex flex-col gap-1">
                  <input type="number" min={0} step={0.5} value={set.kg}
                    onChange={e => updateSet(set.id, 'kg', e.target.value)}
                    placeholder="—" className={numInput} />
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => adjustValue('kg', -2.5)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">-</button>
                    <button onClick={() => adjustValue('kg', 2.5)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">+</button>
                  </div>
                </div>

                {/* Reps Column */}
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <input type="number" min={0} step={1} value={set.reps}
                      onChange={e => updateSet(set.id, 'reps', e.target.value)}
                      placeholder="—" className={numInput} />
                    {isPR && (
                      <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 rounded-full p-0.5 pointer-events-none">
                        <Trophy size={8} className="text-black" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => adjustValue('reps', -1, true)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">-</button>
                    <button onClick={() => adjustValue('reps', 1, true)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">+</button>
                  </div>
                </div>

                {/* RIR Column */}
                <div className="flex flex-col gap-1">
                  <input type="number" min={0} max={5} step={0.5} value={set.rir}
                    onChange={e => updateSet(set.id, 'rir', e.target.value)}
                    placeholder="—" className={numInput} />
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => adjustValue('rir', -0.5)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">-</button>
                    <button onClick={() => adjustValue('rir', 0.5)} className="text-[9px] font-bold bg-surface active:bg-surface-solid text-text-secondary border border-border-custom hover:text-text-primary w-7 h-5 rounded flex items-center justify-center transition-colors">+</button>
                  </div>
                </div>

                <button onClick={() => removeSet(set.id)} className="flex items-center justify-center text-text-muted/60 hover:text-rose-500 active:scale-[0.9] transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          <button onClick={addSet}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-custom bg-surface/30 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
            <Plus size={11} /> Dodaj serię
          </button>

          {current1RM > 0 && (
            <div className="flex justify-between items-center pt-1.5 border-t border-border-custom mt-2">
              <span className="text-[9px] font-black text-text-secondary uppercase tracking-wider">
                Objętość: {sets.reduce((sum, s) => sum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0).toLocaleString()} kg
              </span>
              <span className="text-[9px] font-black text-text-muted tabular-nums">~{current1RM.toFixed(1)} kg 1RM</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({ activity, onChange, onRemove }) {
  return (
    <div className="rounded-2xl border border-border-custom bg-surface/40 backdrop-blur-md px-4 py-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <input type="text" value={activity.name} onChange={e => onChange({ ...activity, name: e.target.value })}
          placeholder="np. Sauna, Rower, Spacer..."
          className="flex-1 bg-transparent text-sm font-bold text-text-primary outline-none placeholder:text-text-muted/40 min-w-0" />
        <button onClick={onRemove} className="p-1 text-text-muted hover:text-rose-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Clock size={11} className="text-text-muted" />
          <input type="number" min={0} value={activity.min} onChange={e => onChange({ ...activity, min: e.target.value })}
            placeholder="0"
            className="w-16 h-9 bg-surface border border-border-custom rounded-xl text-sm font-black text-text-primary text-center outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <span className="text-[11px] font-bold text-text-secondary">min</span>
        </div>
        <input type="text" value={activity.note} onChange={e => onChange({ ...activity, note: e.target.value })}
          placeholder="notatka (opcjonalnie)..."
          className="flex-1 h-9 bg-surface border border-border-custom rounded-xl px-3 text-xs text-text-primary outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/40" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkoutLogger({ session, onBack }) {
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises]     = useState([newExercise()]);
  const [activities, setActivities]   = useState([]);
  const [notes, setNotes]             = useState('');
  const [sessionRpe, setSessionRpe]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [timerStart, setTimerStart]   = useState(null);
  
  // Custom manual time overrides
  const [manualTime, setManualTime] = useState(false);
  const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
  const [workoutDate, setWorkoutDate] = useState(todayStr);
  const [startTimeManual, setStartTimeManual] = useState('18:00');
  const [endTimeManual, setEndTimeManual] = useState('19:00');

  const elapsed = useStopwatch(timerStart);
  const userId  = session?.user?.id;

  const addExercise    = () => setExercises(p => [...p, newExercise()]);
  const removeExercise = id => { if (exercises.length > 1) setExercises(p => p.filter(e => e.id !== id)); };
  const updateExercise = u  => setExercises(p => p.map(e => e.id === u.id ? u : e));

  const addActivity    = () => setActivities(p => [...p, newActivity()]);
  const removeActivity = id => setActivities(p => p.filter(a => a.id !== id));
  const updateActivity = u  => setActivities(p => p.map(a => a.id === u.id ? u : a));

  async function save() {
    const validEx = exercises.filter(e => e.name.trim());
    const validAc = activities.filter(a => a.name.trim());
    if (!validEx.length && !validAc.length) { alert('Dodaj przynajmniej jedno ćwiczenie lub aktywność'); return; }

    setSaving(true);
    try {
      const exLogs = validEx.flatMap(ex =>
        ex.sets.map((s, i) => ({
          exercise_name: ex.name.trim(), set_number: i + 1,
          weight: parseFloat(s.kg) || 0, reps: parseInt(s.reps) || 0,
          rir: s.rir !== '' ? parseFloat(s.rir) : null,
          rpe: null,
          is_pws_or_msp: s.msp === true,
          muscle_tags: ex.tags ?? [],
        }))
      );
      const acLogs = validAc.map((a, i) => ({
        exercise_name: a.note.trim() ? `${a.name.trim()} — ${a.note.trim()}` : a.name.trim(),
        set_number: i + 1, weight: 0, reps: parseInt(a.min) || 0, rpe: null, rir: null, muscle_tags: [],
      }));

      let finalStart = null;
      let finalEnd = null;

      if (manualTime) {
        finalStart = new Date(`${workoutDate}T${startTimeManual}:00`).toISOString();
        finalEnd = new Date(`${workoutDate}T${endTimeManual}:00`).toISOString();
      } else if (timerStart) {
        finalStart = new Date(timerStart).toISOString();
        finalEnd = new Date().toISOString();
      }

      const mspPassed = exLogs.some(l => l.is_pws_or_msp);

      const { error } = await supabase.rpc('save_workout_atomic', {
        p_user_id:     userId,
        p_day_key:     workoutName.trim() || 'Trening',
        p_start_time:  finalStart,
        p_end_time:    finalEnd,
        p_notes:       notes,
        p_msp_passed:  mspPassed,
        p_logs:        [...exLogs, ...acLogs],
        p_session_rpe: sessionRpe,
      });
      if (error) throw error;
      onBack();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen pb-32 transition-colors duration-300">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border-custom p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary flex-1 font-display">Zaloguj Trening</h1>
        {timerStart ? (
          <button onClick={() => setTimerStart(null)} className="flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors">
            <span className="text-[11px] font-black tabular-nums">{elapsed}</span>
            <Square size={11} className="fill-current" />
          </button>
        ) : (
          <button onClick={() => setTimerStart(Date.now())} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors">
            <Play size={13} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">Start</span>
          </button>
        )}
      </header>

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Nazwa (opcjonalnie)</label>
          <input type="text" value={workoutName} onChange={e => setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-surface border border-border-custom rounded-2xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all placeholder:text-text-muted/40" />
        </div>

        {/* Manual Time Picker Row */}
        <div className="rounded-[20px] border border-border-custom bg-surface/30 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-muted" />
              <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Wpisz godziny ręcznie</span>
            </div>
            <input
              type="checkbox"
              checked={manualTime}
              onChange={(event) => {
                setManualTime(event.target.checked);
                if (event.target.checked && timerStart) {
                  setTimerStart(null);
                }
              }}
              className="accent-primary h-4 w-4 rounded border-border-custom bg-surface"
            />
          </div>

          {manualTime && (
            <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Data</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Start</label>
                <input
                  type="time"
                  value={startTimeManual}
                  onChange={(e) => setStartTimeManual(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Koniec</label>
                <input
                  type="time"
                  value={endTimeManual}
                  onChange={(e) => setEndTimeManual(e.target.value)}
                  className="w-full bg-surface border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell size={12} className="text-text-muted" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Ćwiczenia</span>
          </div>
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={updateExercise} onRemove={() => removeExercise(ex.id)} userId={userId} />
          ))}
          <button onClick={addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface/30 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:border-primary/50 hover:text-primary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj ćwiczenie
          </button>
          <VolumeBar exercises={exercises} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-text-muted" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Inne aktywności</span>
          </div>
          {activities.map(a => (
            <ActivityCard key={a.id} activity={a} onChange={updateActivity} onRemove={() => removeActivity(a.id)} />
          ))}
          <button onClick={addActivity}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface/30 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:border-orange-500/50 hover:text-orange-400 transition-all cursor-pointer">
            <Plus size={13} /> Dodaj aktywność
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Notatki</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Jak poszło?..."
            className="w-full bg-surface border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[100px] outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all resize-none placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
            {sessionRpe && (
              <button onClick={() => setSessionRpe(null)} className="text-[9px] text-text-muted hover:text-text-secondary transition-colors">wyczyść</button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const color = n <= 4 ? 'border-sky-500/40 text-sky-550 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 hover:bg-sky-500/15'
                          : n <= 6 ? 'border-yellow-500/45 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 dark:bg-yellow-500/10 hover:bg-yellow-500/15'
                          : n <= 8 ? 'border-orange-500/45 text-orange-600 dark:text-orange-400 bg-orange-500/5 dark:bg-orange-500/10 hover:bg-orange-500/15'
                          : 'border-dayB/45 text-dayB bg-dayB/5 dark:bg-dayB/10 hover:bg-dayB/15';
              const active = sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 scale-105 shadow-sm' : 'opacity-60';
              return (
                <button key={n} onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
                  className={`rounded-lg border py-2 text-[11px] font-black transition-all cursor-pointer ${color} ${active}`}>
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-muted">
            {sessionRpe ? (sessionRpe <= 4 ? 'Łatwa — dużo rezerwy' : sessionRpe <= 6 ? 'Umiarkowana' : sessionRpe <= 8 ? 'Ciężka — mało rezerwy' : 'Maksymalna — do oporu') : 'Jak ciężka była cała sesja?'}
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border-custom space-y-3 z-30">
        {(() => {
          const totalVol = exercises.reduce((sum, ex) => {
            const exVol = (ex.sets || []).reduce((sSum, s) => sSum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
            return sum + exVol;
          }, 0);
          if (totalVol === 0) return null;
          return (
            <div className="flex justify-between items-center px-1 max-w-md mx-auto w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Suma Objętości:</span>
              <span className="text-[12px] font-black text-primary tracking-wide font-display">{totalVol.toLocaleString()} kg</span>
            </div>
          );
        })()}
        <div className="max-w-md mx-auto w-full">
          <button onClick={save} disabled={saving}
            className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform hover:bg-primary-hover cursor-pointer">
            <Save size={15} />
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </footer>
    </div>
  );
}
