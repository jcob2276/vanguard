import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, ChevronLeft, Save } from 'lucide-react';

const newRow = () => ({ id: Date.now() + Math.random(), name: '', kg: '', rir: '' });

export default function WorkoutLogger({ session, onBack }) {
  const [workoutName, setWorkoutName] = useState('');
  const [rows, setRows] = useState([newRow()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(() => new Date());

  function addRow() {
    setRows(prev => {
      const last = prev[prev.length - 1];
      return [...prev, { ...newRow(), name: last?.name || '' }];
    });
  }

  function removeRow(id) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }

  function update(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  async function save() {
    const valid = rows.filter(r => r.name.trim());
    if (!valid.length) { alert('Dodaj przynajmniej jeden wiersz z nazwą ćwiczenia'); return; }

    setSaving(true);
    try {
      const setCount = {};
      const logs = valid.map(r => {
        const name = r.name.trim();
        setCount[name] = (setCount[name] || 0) + 1;
        return {
          exercise_name: name,
          set_number: setCount[name],
          weight: parseFloat(r.kg) || 0,
          reps: 0,
          rpe: r.rir !== '' ? parseFloat(r.rir) : null,
        };
      });

      const { error } = await supabase.rpc('save_workout_atomic', {
        p_user_id: session.user.id,
        p_day_key: workoutName.trim() || 'Trening',
        p_start_time: startTime.toISOString(),
        p_end_time: new Date().toISOString(),
        p_notes: notes,
        p_msp_passed: false,
        p_logs: logs,
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
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white">Loguj Trening</h1>
      </header>

      <main className="flex-1 p-5 space-y-6">
        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-widest text-white/35">Nazwa treningu (opcjonalnie)</label>
          <input
            type="text"
            value={workoutName}
            onChange={e => setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-neutral-950 border border-white/5 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary transition-colors placeholder:text-white/20"
          />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_64px_56px_32px] gap-2 px-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/25">Ćwiczenie</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/25 text-center">KG</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/25 text-center">RIR</span>
            <span />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_64px_56px_32px] gap-2 items-center">
              <input
                type="text"
                value={r.name}
                onChange={e => update(r.id, 'name', e.target.value)}
                placeholder="Nazwa ćwiczenia"
                className="bg-neutral-950 border border-white/5 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-primary transition-colors placeholder:text-white/20"
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={r.kg}
                onChange={e => update(r.id, 'kg', e.target.value)}
                placeholder="—"
                className="bg-neutral-950 border border-white/5 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-primary transition-colors placeholder:text-white/15"
              />
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={r.rir}
                onChange={e => update(r.id, 'rir', e.target.value)}
                placeholder="—"
                className="bg-neutral-950 border border-white/5 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-primary transition-colors placeholder:text-white/15"
              />
              <button
                onClick={() => removeRow(r.id)}
                className="flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-[10px] font-black uppercase tracking-widest text-white/30 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Plus size={14} /> Dodaj serię
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-widest text-white/35">Notatki</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Jak poszło?..."
            className="w-full bg-neutral-950 border border-white/5 rounded-xl p-3 text-sm text-white min-h-[100px] outline-none focus:border-primary transition-colors resize-none placeholder:text-white/20"
          />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-sm border-t border-white/5">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Zapisywanie...' : 'Zapisz Trening'}
        </button>
      </footer>
    </div>
  );
}
