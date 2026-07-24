/**
 * @component OuraSmartSleepCyclesCard
 * @role Kalkulator 90-minutowych cykli snu z optymalizacją godziny budzenia bez efektu inercji sennej.
 */
import { useState } from 'react';
import { AlarmClock } from 'lucide-react';

export function OuraSmartSleepCyclesCard() {
  const [bedtimeStr, setBedtimeStr] = useState('23:30');

  const calculateWakeTimes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 14, 0, 0); // +14 min average latency to fall asleep

    // 4, 5, and 6 cycles (each 90 minutes)
    return [4, 5, 6].map((numCycles) => {
      const wakeDate = new Date(date.getTime() + numCycles * 90 * 60 * 1000);
      const wakeStr = wakeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const totalHours = (numCycles * 90) / 60;
      return { numCycles, wakeStr, totalHours };
    });
  };

  const wakeTimes = calculateWakeTimes(bedtimeStr);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlarmClock size={18} className="text-teal-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">INTELIGENTNY KALKULATOR CYKLI SNU (90-MIN)</h4>
        </div>
      </div>

      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
        <div>
          <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Planowana godzina położenia się do łóżka</p>
          <input
            type="time"
            value={bedtimeStr}
            onChange={(e) => setBedtimeStr(e.target.value)}
            className="text-2xl font-black text-white bg-transparent focus:outline-none cursor-pointer mt-0.5"
          />
        </div>
        <span className="text-3xs text-slate-400">Uwzględnia ~14 min zasypiania</span>
      </div>

      {/* Suggested Wake Times Grid */}
      <div className="space-y-2 pt-1">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">OPTYMALNE GODZINY POBUDKI (SEN LEKKI):</p>
        <div className="grid grid-cols-3 gap-2">
          {wakeTimes.map((item) => (
            <div
              key={item.numCycles}
              className={`p-3 rounded-2xl border text-center transition-all ${
                item.numCycles === 5
                  ? 'bg-teal-500/20 border-teal-500/40 text-white shadow-glow'
                  : 'bg-white/5 border-white/5 text-slate-300'
              }`}
            >
              <p className="text-2xs font-extrabold uppercase text-teal-400">{item.numCycles} Cykli ({item.totalHours}h)</p>
              <p className="text-xl font-black mt-1">{item.wakeStr}</p>
              <p className="text-3xs text-slate-400 mt-0.5">{item.numCycles === 5 ? 'Rekomendowane' : 'Alternatywne'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
