import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, ChevronLeft, Save, Dumbbell, Zap, ChevronDown, ChevronUp, Clock, Play, Square, Trophy, X } from 'lucide-react';

import { EXERCISES, ALL_TAGS, tagClass, normalize } from '../data/exercises';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newSet      = () => ({ id: Date.now() + Math.random(), kg: '', reps: '', rir: '' });
const newExercise = () => ({ id: Date.now() + Math.random(), name: '', tags: [], sets: [newSet()] });
const newActivity = () => ({ id: Date.now() + Math.random(), name: '', min: '', note: '' });

const numInput = "h-11 w-full bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm font-black text-white text-center outline-none focus:border-primary/60 focus:bg-white/[0.09] transition-all placeholder:text-white/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";


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
        .select('weight, reps, set_number, session_id, workout_sessions!inner(start_time)')
        .eq('user_id', userId)
        .eq('exercise_name', trimmed)
        .order('start_time', { foreignTable: 'workout_sessions', ascending: false })
        .limit(60);

      if (!data?.length) { setLastSession(null); setAllTimeBest1RM(null); return; }

      const bySession = {};
      for (const row of data) {
        if (!bySession[row.session_id]) bySession[row.session_id] = [];
        bySession[row.session_id].push(row);
      }
      const last = Object.values(bySession)[0].sort((a, b) => a.set_number - b.set_number);
      setLastSession(last);

      const best = data.reduce((max, r) => { const e = epley(r.weight, r.reps); return e && e > max ? e : max; }, 0);
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
        className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-white/[0.1] bg-zinc-900 shadow-xl overflow-hidden">
          {matches.map(ex => (
            <button
              key={ex.name}
              onMouseDown={() => select(ex)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors gap-3"
            >
              <span className="text-sm text-white/80 font-medium">{ex.name}</span>
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
            className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-dashed border-white/[0.15] text-white/30 hover:text-white/60 hover:border-white/30 transition-colors"
          >
            + tag
          </button>
          {picking && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl border border-white/[0.1] bg-zinc-900 shadow-xl p-2 flex flex-wrap gap-1 w-52">
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

// ─── Progressive overload suggestion ─────────────────────────────────────────

function getSuggestion(lastSession) {
  if (!lastSession?.length) return null;
  const maxW = Math.max(...lastSession.map(s => s.weight));
  if (!maxW) return null;
  const minReps = Math.min(...lastSession.map(s => s.reps));
  const maxReps = Math.max(...lastSession.map(s => s.reps));
  const repsConsistent = (maxReps - minReps) <= 1;
  const increment = maxW >= 40 ? 2.5 : 1.25;
  return repsConsistent ? maxW + increment : maxW;
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onChange, onRemove, userId }) {
  const [collapsed, setCollapsed] = useState(false);
  const sets = exercise.sets ?? [];
  const tags = exercise.tags ?? [];
  const { lastSession, allTimeBest1RM } = useExerciseHistory(exercise.name ?? '', userId);

  function addSet() {
    const last = sets[sets.length - 1];
    onChange({ ...exercise, sets: [...exercise.sets, { ...newSet(), kg: last.kg, rir: last.rir }] });
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
    <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <ExerciseNameInput
          value={exercise.name}
          tags={exercise.tags}
          onChange={(name, tags) => onChange({ ...exercise, name, tags })}
        />
        <button onClick={() => setCollapsed(c => !c)} className="p-1 text-white/30 hover:text-white/60 transition-colors">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-white/25 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tags */}
      {(tags.length > 0 || (exercise.name ?? '').trim().length > 0) && (
        <TagRow tags={tags} onChange={t => onChange({ ...exercise, tags: t })} />
      )}

      {/* Ostatnio + sugestia */}
      {lastSession && (
        <div className="px-4 py-1.5 border-t border-white/[0.04] flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Ostatnio</span>
          <span className="text-[10px] font-bold text-white/40">{formatLastSession(lastSession)}</span>
          {(() => {
            const s = getSuggestion(lastSession);
            const lastW = Math.max(...lastSession.map(x => x.weight));
            const progressed = s > lastW;
            return s ? (
              <span className={`ml-auto text-[10px] font-black ${progressed ? 'text-emerald-400' : 'text-white/40'}`}>
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
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 text-center">KG</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 text-center">Pow.</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 text-center">RIR</span>
            <span />
          </div>

          {exercise.sets.map((set, idx) => {
            const set1RM = epley(set.kg, set.reps);
            const isPR = set1RM && allTimeBest1RM && set1RM > allTimeBest1RM;

            const adjustValue = (field, step, isInt = false) => {
              const currentVal = parseFloat(set[field]);
              if (isNaN(currentVal)) {
                // Default fallback if empty
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
                <span className="text-[10px] font-black text-white/30 text-center">{idx + 1}</span>
                
                {/* KG Column */}
                <div className="flex flex-col gap-1">
                  <input type="number" min={0} step={0.5} value={set.kg}
                    onChange={e => updateSet(set.id, 'kg', e.target.value)}
                    placeholder="—" className={numInput} />
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => adjustValue('kg', -2.5)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">-</button>
                    <button onClick={() => adjustValue('kg', 2.5)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">+</button>
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
                    <button onClick={() => adjustValue('reps', -1, true)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">-</button>
                    <button onClick={() => adjustValue('reps', 1, true)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">+</button>
                  </div>
                </div>

                {/* RIR Column */}
                <div className="flex flex-col gap-1">
                  <input type="number" min={0} max={5} step={0.5} value={set.rir}
                    onChange={e => updateSet(set.id, 'rir', e.target.value)}
                    placeholder="—" className={numInput} />
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => adjustValue('rir', -0.5)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">-</button>
                    <button onClick={() => adjustValue('rir', 0.5)} className="text-[9px] font-bold bg-white/[0.04] active:bg-white/[0.1] text-white/50 border border-white/[0.08] w-7 h-5 rounded flex items-center justify-center">+</button>
                  </div>
                </div>

                <button onClick={() => removeSet(set.id)} className="flex items-center justify-center text-white/20 hover:text-red-400 active:scale-[0.9] transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          <button onClick={addSet}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] py-2 text-[10px] font-black uppercase tracking-widest text-white/35 hover:border-primary/40 hover:text-primary transition-colors">
            <Plus size={11} /> Dodaj serię
          </button>

          {current1RM > 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-white/[0.04] mt-2">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-wider">
                Objętość: {sets.reduce((sum, s) => sum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0).toLocaleString()} kg
              </span>
              <span className="text-[9px] font-black text-white/25 tabular-nums">~{current1RM.toFixed(1)} kg 1RM</span>
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
    <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <input type="text" value={activity.name} onChange={e => onChange({ ...activity, name: e.target.value })}
          placeholder="np. Sauna, Rower, Spacer..."
          className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35 min-w-0" />
        <button onClick={onRemove} className="p-1 text-white/25 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Clock size={11} className="text-white/35" />
          <input type="number" min={0} value={activity.min} onChange={e => onChange({ ...activity, min: e.target.value })}
            placeholder="0"
            className="w-16 h-9 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm font-black text-white text-center outline-none focus:border-primary/60 transition-all placeholder:text-white/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <span className="text-[11px] font-bold text-white/40">min</span>
        </div>
        <input type="text" value={activity.note} onChange={e => onChange({ ...activity, note: e.target.value })}
          placeholder="notatka (opcjonalnie)..."
          className="flex-1 h-9 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-xs text-white outline-none focus:border-primary/60 transition-all placeholder:text-white/30" />
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
          rpe: s.rir !== '' ? parseFloat(s.rir) : null,
          muscle_tags: ex.tags ?? [],
        }))
      );
      const acLogs = validAc.map((a, i) => ({
        exercise_name: a.note.trim() ? `${a.name.trim()} — ${a.note.trim()}` : a.name.trim(),
        set_number: i + 1, weight: 0, reps: parseInt(a.min) || 0, rpe: null, rir: null, muscle_tags: [],
      }));

      let finalStart = new Date().toISOString();
      let finalEnd = new Date().toISOString();

      if (manualTime) {
        finalStart = new Date(`${workoutDate}T${startTimeManual}:00`).toISOString();
        finalEnd = new Date(`${workoutDate}T${endTimeManual}:00`).toISOString();
      } else if (timerStart) {
        finalStart = new Date(timerStart).toISOString();
      }

      const { error } = await supabase.rpc('save_workout_atomic', {
        p_user_id:    userId,
        p_day_key:    workoutName.trim() || 'Trening',
        p_start_time: finalStart,
        p_end_time:   finalEnd,
        p_notes:      notes,
        p_msp_passed: false,
        p_logs:       [...exLogs, ...acLogs],
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
    <div className="flex-1 bg-black flex flex-col min-h-screen pb-32">
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/[0.07] p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 text-white/50 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white flex-1">Zaloguj Trening</h1>
        {timerStart ? (
          <button onClick={() => setTimerStart(null)} className="flex items-center gap-1.5 text-primary hover:text-white transition-colors">
            <span className="text-[11px] font-black tabular-nums">{elapsed}</span>
            <Square size={11} className="fill-current" />
          </button>
        ) : (
          <button onClick={() => setTimerStart(Date.now())} className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors">
            <Play size={13} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">Start</span>
          </button>
        )}
      </header>

      <main className="flex-1 p-5 space-y-8">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-white/50">Nazwa (opcjonalnie)</label>
          <input type="text" value={workoutName} onChange={e => setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/60 focus:bg-white/[0.06] transition-all placeholder:text-white/35" />
        </div>

        {/* Manual Time Picker Row */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-white/50" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white/70">Wpisz godziny ręcznie</span>
            </div>
            <input
              type="checkbox"
              checked={manualTime}
              onChange={(e) => {
                setManualTime(e.target.checked);
                if (e.target.checked && timerStart) {
                  setTimerStart(null); // turn off stopwatch
                }
              }}
              className="accent-primary h-4 w-4 rounded border-white/[0.1] bg-white/[0.05]"
            />
          </div>

          {manualTime && (
            <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40">Data</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-xs font-bold text-white outline-none focus:border-primary/60 text-center"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40">Start</label>
                <input
                  type="time"
                  value={startTimeManual}
                  onChange={(e) => setStartTimeManual(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-xs font-bold text-white outline-none focus:border-primary/60 text-center"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-white/40">Koniec</label>
                <input
                  type="time"
                  value={endTimeManual}
                  onChange={(e) => setEndTimeManual(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-xs font-bold text-white outline-none focus:border-primary/60 text-center"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell size={12} className="text-white/50" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">Ćwiczenia</span>
          </div>
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={updateExercise} onRemove={() => removeExercise(ex.id)} userId={userId} />
          ))}
          <button onClick={addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-3.5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:border-primary/50 hover:text-primary transition-colors">
            <Plus size={13} /> Dodaj ćwiczenie
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-white/50" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">Inne aktywności</span>
          </div>
          {activities.map(a => (
            <ActivityCard key={a.id} activity={a} onChange={updateActivity} onRemove={() => removeActivity(a.id)} />
          ))}
          <button onClick={addActivity}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-3.5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:border-orange-500/50 hover:text-orange-400 transition-colors">
            <Plus size={13} /> Dodaj aktywność
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-white/50">Notatki</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Jak poszło?..."
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white min-h-[100px] outline-none focus:border-primary/60 focus:bg-white/[0.06] transition-all resize-none placeholder:text-white/35" />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-sm border-t border-white/[0.07] space-y-3">
        {(() => {
          const totalVol = exercises.reduce((sum, ex) => {
            const exVol = (ex.sets || []).reduce((sSum, s) => sSum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
            return sum + exVol;
          }, 0);
          if (totalVol === 0) return null;
          return (
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Suma Objętości:</span>
              <span className="text-[12px] font-black text-primary tracking-wide">{totalVol.toLocaleString()} kg</span>
            </div>
          );
        })()}
        <button onClick={save} disabled={saving}
          className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
          <Save size={15} />
          {saving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </footer>
    </div>
  );
}
