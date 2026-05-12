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

  async function updateRPE(value) {
    if (!todayWin) return;
    const { data, error } = await supabase
      .from('daily_wins')
      .update({ daily_rpe: value })
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
            const completedAt = todayWin[`completed_at_${i+1}`];
            
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
                  <div>
                    <p className={`text-[12px] font-black uppercase italic tracking-tight ${done ? 'line-through text-neutral-600' : 'text-white'}`}>{task}</p>
                    {done && completedAt && (
                      <p className="text-[8px] font-bold text-dayC/60 mt-0.5">COMPLETED AT {format(new Date(completedAt), 'HH:mm')}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* RPE Selector */}
          <div className="mt-8 pt-6 border-t border-neutral-800 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Daily Effort (RPE)</h4>
              <span className="text-[14px] font-black text-primary">{todayWin.daily_rpe || '-'}</span>
            </div>
            <div className="flex justify-between gap-1">
              {[1,2,3,4,5,6,7,8,9,10].map(val => (
                <button
                  key={val}
                  onClick={() => updateRPE(val)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${todayWin.daily_rpe === val ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-neutral-950 text-neutral-600 hover:bg-neutral-800'}`}
                >
                  {val}
                </button>
              ))}
            </div>
            <p className="text-[8px] font-bold text-neutral-600 text-center uppercase tracking-tighter">
              1 = Spacer w słońcu | 10 = Walka o życie (Kortyzol Peak)
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
