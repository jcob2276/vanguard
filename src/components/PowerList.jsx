import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Shield, Zap, Wallet, CheckSquare, Target, Trophy, Plus, X } from 'lucide-react';

export default function PowerList({ session, todayWin, onUpdate }) {
  const [isPlanningTomorrow, setIsPlanningTomorrow] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState([
    { task: '', category: 'cialo' },
    { task: '', category: 'duch' },
    { task: '', category: 'konto' },
    { task: '', category: 'cialo' },
    { task: '', category: 'duch' },
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
      task_1: newTaskForm[0].task, category_1: newTaskForm[0].category,
      task_2: newTaskForm[1].task, category_2: newTaskForm[1].category,
      task_3: newTaskForm[2].task, category_3: newTaskForm[2].category,
      task_4: newTaskForm[3].task, category_4: newTaskForm[3].category,
      task_5: newTaskForm[4].task, category_5: newTaskForm[4].category,
      result: null
    };

    const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
    if (!error && onUpdate) onUpdate(data);
    else alert('Błąd startu dnia');
  }

  const catIcons = {
    cialo: <Shield size={14} className="text-dayC" />,
    duch: <Zap size={14} className="text-dayA" />,
    konto: <Wallet size={14} className="text-dayD" />
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Target size={12} className="text-primary" /> Power List Execution
          </h3>
        </div>
        {todayWin?.result === 'Z' && (
          <div className="bg-dayC/10 text-dayC px-2 py-0.5 rounded text-[8px] font-black uppercase border border-dayC/20">Executed</div>
        )}
      </div>

      {!todayWin ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4 shadow-xl">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest text-center">Zdefiniuj 5 Zwycięstw</h3>
          <div className="space-y-3">
            {newTaskForm.map((t, i) => (
              <div key={i} className="flex gap-2">
                <select 
                  value={t.category}
                  onChange={(e) => {
                    const n = [...newTaskForm]; n[i].category = e.target.value; setNewTaskForm(n);
                  }}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-1 text-[9px] font-black text-primary outline-none uppercase"
                >
                  <option value="cialo">Ciało</option>
                  <option value="duch">Duch</option>
                  <option value="konto">Konto</option>
                </select>
                <input 
                  placeholder={`Zadanie ${i+1}`}
                  value={t.task}
                  onChange={(e) => {
                    const n = [...newTaskForm]; n[i].task = e.target.value; setNewTaskForm(n);
                  }}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-[11px] font-bold text-white outline-none focus:border-primary placeholder:text-neutral-800"
                />
              </div>
            ))}
          </div>
          <button onClick={startNewDay} className="w-full bg-primary text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10">Zatwierdź Operację</button>
        </div>
      ) : (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => {
            const task = todayWin[`task_${i+1}`];
            const category = todayWin[`category_${i+1}`];
            const done = todayWin[`done_${i+1}`];
            
            return (
              <button 
                key={i} 
                onClick={() => toggleTask(i)}
                className={`w-full bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between group transition-all ${done ? 'opacity-40 grayscale' : 'hover:bg-neutral-800/50 hover:ring-1 hover:ring-primary/30'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded border flex items-center justify-center ${done ? 'bg-dayC border-dayC text-white' : 'border-neutral-800 text-transparent'}`}>
                    {done ? <CheckSquare size={14} /> : <Target size={14} />}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      {catIcons[category]}
                      <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest">{category}</span>
                    </div>
                    <p className={`text-[11px] font-black uppercase italic ${done ? 'line-through text-neutral-600' : 'text-white'}`}>{task}</p>
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
