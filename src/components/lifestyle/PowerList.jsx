import { useState } from 'react';
import { supabase } from '../../lib/supabase';
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
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted font-display">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' && (
          <div className="rounded-full bg-dayC/10 border border-dayC/15 px-2.5 py-0.5 text-[9px] font-bold text-dayC font-display">Executed</div>
        )}
      </div>

      {!todayWin ? (
        <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
          <div>
            <h3 className="text-[14px] font-black tracking-tight text-text-primary font-display">Zdefiniuj 5 zwycięstw</h3>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">To zostaje na głównym ekranie jako plan dnia.</p>
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
                className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-[13px] font-medium text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
              />
            ))}
          </div>
          <button onClick={startNewDay} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover py-3.5 text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] font-display cursor-pointer">
            <Upload size={14} /> Zatwierdź operację
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {[0,1,2,3,4].map((i) => {
            const task = todayWin[`task_${i+1}`];
            const done = todayWin[`done_${i+1}`];
            const completedAt = todayWin[`completed_at_${i+1}`];
            if (!task) return null;

            return (
              <button 
                key={i} 
                onClick={() => toggleTask(i)}
                className={`group flex w-full items-center justify-between rounded-[20px] border p-4 transition-all hover:-translate-y-0.5 cursor-pointer ${
                  done 
                    ? 'border-border-custom bg-surface/30 opacity-60 shadow-none' 
                    : 'border-border-custom bg-surface shadow-sm hover:border-primary/25 hover:bg-surface-solid hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`flex h-6.5 w-6.5 items-center justify-center rounded-full border transition-all duration-300 ${
                    done 
                      ? 'bg-dayC border-dayC text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]' 
                      : 'border-border-custom text-transparent bg-surface-solid group-hover:border-primary/40 group-hover:bg-surface-solid'
                  }`}>
                    <CheckSquare size={13} fill={done ? 'currentColor' : 'none'} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold tracking-normal transition-all ${
                      done 
                        ? 'line-through text-text-muted' 
                        : 'text-text-primary'
                    }`}>{task}</p>
                    {done && completedAt && (
                      <p className="mt-0.5 text-[9px] font-semibold text-dayC/80">Zrobione o {format(new Date(completedAt), 'HH:mm')}</p>
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
