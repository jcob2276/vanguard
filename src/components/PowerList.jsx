import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { CheckSquare, Target, Upload } from 'lucide-react';

export default function PowerList({ session, todayWin, onUpdate }) {
  const [newTaskForm, setNewTaskForm] = useState([
    { task: '', category: 'general' },
    { task: '', category: 'general' },
    { task: '', category: 'general' },
    { task: '', category: 'general' },
    { task: '', category: 'general' },
  ]);

  async function toggleTask(index) {
    if (!todayWin) return;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const newValue = !todayWin[field];
    const timestamp = newValue ? new Date().toISOString() : null;
    
    const allDone = [1, 2, 3, 4, 5].every(i => {
      if (!todayWin[`task_${i}`]) return true; // puste sloty ignoruj
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { 
      [field]: newValue,
      [timeField]: timestamp 
    };

    if (allDone) updates.result = 'Z';
    else {
      if (todayWin.result === 'Z') updates.result = null;
      const isPastDeadline = new Date().getHours() >= 23;
      if (isPastDeadline && !allDone) updates.result = 'P';
    }

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', todayWin.id)
      .select()
      .single();
    
    if (!error && onUpdate) onUpdate(data);
  }

  async function startNewDay() {
    if (!newTaskForm.some(t => t.task.trim())) {
      alert('Wypełnij przynajmniej 1 zadanie!');
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const entry = {
      user_id: session.user.id,
      date: today,
      task_1: newTaskForm[0].task, category_1: 'general',
      task_2: newTaskForm[1].task, category_2: 'general',
      task_3: newTaskForm[2].task, category_3: 'general',
      task_4: newTaskForm[3].task, category_4: 'general',
      task_5: newTaskForm[4].task, category_5: 'general',
      result: null
    };

    const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
    if (!error && onUpdate) onUpdate(data);
    else alert('Błąd startu dnia');
  }

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-end">
        <h3 className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
          <Target size={12} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' && (
          <div className="rounded-md border border-dayC/20 bg-dayC/10 px-2 py-0.5 text-[8px] font-black uppercase text-dayC">Executed</div>
        )}
      </div>

      {!todayWin ? (
        <div className="space-y-4 rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(12,12,13,0.96))] p-5 shadow-2xl shadow-black/30">
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-[0.12em] text-white">Zdefiniuj 5 zwycięstw</h3>
            <p className="mt-1 text-[10px] font-bold leading-relaxed text-white/35">To zostaje na głównym ekranie jako plan dnia.</p>
          </div>
          <div className="space-y-3">
            {newTaskForm.map((t, i) => (
              <input 
                key={i}
                placeholder={`Zadanie ${i+1}`}
                value={t.task}
                onChange={(e) => {
                  const n = [...newTaskForm]; n[i].task = e.target.value; setNewTaskForm(n);
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none transition-all placeholder:text-white/16 focus:border-primary/70 focus:bg-black/65"
              />
            ))}
          </div>
          <button onClick={startNewDay} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]">
            <Upload size={14} /> Zatwierdź operację
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => {
            const task = todayWin[`task_${i+1}`];
            const done = todayWin[`done_${i+1}`];
            const completedAt = todayWin[`completed_at_${i+1}`];
            if (!task) return null;

            return (
              <button 
                key={i} 
                onClick={() => toggleTask(i)}
                className={`group flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-neutral-950/80 p-4 transition-all ${done ? 'opacity-38 grayscale' : 'hover:border-primary/30 hover:bg-white/[0.04]'}`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md border transition-all ${done ? 'bg-dayC border-dayC text-white shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'border-white/[0.1] text-transparent'}`}>
                    <CheckSquare size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[12px] font-black uppercase tracking-[0.04em] ${done ? 'line-through text-white/25' : 'text-white/88'}`}>{task}</p>
                    {done && completedAt && (
                      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-dayC/60">Completed at {format(new Date(completedAt), 'HH:mm')}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
