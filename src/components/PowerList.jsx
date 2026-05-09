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
    const newValue = !todayWin[field];
    
    const allDone = [1, 2, 3, 4, 5].every(i => {
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { [field]: newValue };
    if (allDone) updates.result = 'Z';
    else {
      const isPastDeadline = new Date().getHours() >= 23;
      updates.result = isPastDeadline ? 'P' : null;
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
    if (newTaskForm.some(t => !t.task.trim())) {
      alert('Wypełnij wszystkie 5 zadań!');
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
        <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
          <Target size={12} className="text-primary" /> Power List Execution
        </h3>
        {todayWin?.result === 'Z' && (
          <div className="bg-dayC/10 text-dayC px-2 py-0.5 rounded text-[8px] font-black uppercase border border-dayC/20 animate-pulse">Executed</div>
        )}
      </div>

      {!todayWin ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest text-center">Zdefiniuj 5 Zwycięstw</h3>
          <div className="space-y-3">
            {newTaskForm.map((t, i) => (
              <input 
                key={i}
                placeholder={`Zadanie ${i+1}`}
                value={t.task}
                onChange={(e) => {
                  const n = [...newTaskForm]; n[i].task = e.target.value; setNewTaskForm(n);
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[11px] font-bold text-white outline-none focus:border-primary placeholder:text-neutral-800 transition-all"
              />
            ))}
          </div>
          <button onClick={startNewDay} className="w-full bg-primary text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <Upload size={14} /> Zatwierdź Operację
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => {
            const task = todayWin[`task_${i+1}`];
            const done = todayWin[`done_${i+1}`];
            
            return (
              <button 
                key={i} 
                onClick={() => toggleTask(i)}
                className={`w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between group transition-all ${done ? 'opacity-30 grayscale' : 'hover:bg-neutral-800/50 hover:border-primary/30'}`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${done ? 'bg-dayC border-dayC text-white shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'border-neutral-800 text-transparent'}`}>
                    <CheckSquare size={14} />
                  </div>
                  <p className={`text-[12px] font-black uppercase italic tracking-tight ${done ? 'line-through text-neutral-600' : 'text-white'}`}>{task}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
