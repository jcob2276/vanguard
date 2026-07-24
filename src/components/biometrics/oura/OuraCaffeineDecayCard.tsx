/**
 * @component OuraCaffeineDecayCard
 * @role Krzywa rozpadu kofeiny (half-life t1/2 = 5.7h) z prognozą kofeiny we krwi o porze zasypiania.
 */
import { useState } from 'react';
import { Coffee, Plus, Trash2 } from 'lucide-react';

interface CaffeineEntry {
  id: string;
  name: string;
  amountMg: number;
  timeStr: string; // e.g. "13:30"
}

export function OuraCaffeineDecayCard() {
  const [entries, setEntries] = useState<CaffeineEntry[]>([
    { id: '1', name: 'Podwójne Espresso', amountMg: 160, timeStr: '08:30' },
    { id: '2', name: 'Kawa z ekserka', amountMg: 100, timeStr: '13:15' },
  ]);

  const [newName, setNewName] = useState('Kawa');
  const [newMg, setNewMg] = useState(100);
  const [newTime, setNewTime] = useState('14:00');

  // Compute caffeine at bedtime (23:30)
  const bedtimeHour = 23.5;

  const calculateRemainingMgAtHour = (targetHour: number) => {
    return entries.reduce((acc, entry) => {
      const [h, m] = entry.timeStr.split(':').map(Number);
      const entryHour = h + m / 60;
      if (targetHour < entryHour) return acc;
      const hoursElapsed = targetHour - entryHour;
      const remaining = entry.amountMg * Math.pow(0.5, hoursElapsed / 5.7);
      return acc + remaining;
    }, 0);
  };

  const bedtimeRemainingMg = Math.round(calculateRemainingMgAtHour(bedtimeHour));

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newName, amountMg: newMg, timeStr: newTime },
    ]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee size={18} className="text-amber-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">KRZYWA ROZPADU KOFEINY</h4>
        </div>
        <span className="text-3xs font-extrabold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          Half-Life t½ = 5.7h
        </span>
      </div>

      <div className="flex items-baseline justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
        <div>
          <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Kofeina w krwiobiegu o 23:30</p>
          <p className="text-2xl font-black text-white mt-0.5">{bedtimeRemainingMg} mg</p>
        </div>
        <span className={`text-3xs font-bold px-2 py-1 rounded-full ${bedtimeRemainingMg > 30 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
          {bedtimeRemainingMg > 30 ? 'Może opóźnić faza Deep' : 'Bezpieczny poziom'}
        </span>
      </div>

      {/* Interactive Graph Canvas */}
      <div className="relative h-28 w-full rounded-2xl bg-black/40 p-2 border border-white/5 overflow-hidden">
        <svg className="h-full w-full overflow-visible" viewBox="0 0 400 80" preserveAspectRatio="none">
          <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <path
            d="M 0 75 L 80 20 Q 180 35 240 45 T 380 68 L 400 70 L 400 80 L 0 80 Z"
            fill="rgba(245, 158, 11, 0.15)"
          />
          <path
            d="M 0 75 L 80 20 Q 180 35 240 45 T 380 68 L 400 70"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="380" cy="68" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
        </svg>
      </div>

      {/* Entry Logger */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Kawa / Napój"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <input
            type="number"
            value={newMg}
            onChange={(e) => setNewMg(Number(e.target.value))}
            placeholder="mg"
            className="w-16 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center focus:outline-none"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-24 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center focus:outline-none"
          />
          <button
            onClick={addEntry}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/5">
              <span className="font-semibold text-slate-200">{entry.name} ({entry.amountMg} mg)</span>
              <div className="flex items-center gap-2 text-slate-400">
                <span>{entry.timeStr}</span>
                <button onClick={() => removeEntry(entry.id)} className="hover:text-rose-400 transition-colors cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
