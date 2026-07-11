import { Zap, Flame, Droplet } from 'lucide-react';
import type { useNutritionData } from '../useNutritionData';

type NutritionData = ReturnType<typeof useNutritionData>;

interface NutritionMacroBoxesProps {
  proteinGoal: number;
  todayMacros: NutritionData['todayMacros'];
  pPct: number;
  cPct: number;
  fPct: number;
}

export default function NutritionMacroBoxes({ proteinGoal, todayMacros, pPct, cPct, fPct }: NutritionMacroBoxesProps) {
  const protPct = proteinGoal > 0 ? Math.round((todayMacros.protein / proteinGoal) * 100) : 100;
  const protLow = protPct < 55 && todayMacros.protein > 0;

  return (
    <>
      {/* Suma makro dzisiaj */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {/* Protein Box */}
        <div className={`rounded-2xl border-l-4 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between ${protLow ? 'border-l-rose-500/80 bg-rose-500/5' : 'border-l-primary/70'}`}>
          <div>
            <p className={`text-[8px] font-black uppercase tracking-wider mb-1 flex items-center justify-center gap-1 ${protLow ? 'text-rose-500' : 'text-primary'}`}>
              <Zap size={9} className={protLow ? 'fill-rose-500' : 'fill-primary'} /> Białko (B)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.protein}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${protLow ? 'bg-rose-500' : 'bg-primary'}`}
                style={{ width: `${Math.min((todayMacros.protein / (proteinGoal || 1)) * 100, 100)}%` }}
              />
            </div>
            <p className={`text-[7.5px] font-bold mt-1 ${protLow ? 'text-rose-400' : 'text-text-muted'}`}>
              {proteinGoal > 0 ? `${protPct}% celu` : '—'}
            </p>
          </div>
        </div>

        {/* Carbs Box */}
        <div className="rounded-2xl border-l-4 border-l-amber-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-amber-500 mb-1 flex items-center justify-center gap-1">
              <Flame size={9} className="fill-amber-500" /> Węgle (W)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.carbs}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${cPct}%` }}
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(cPct)}% makro
            </p>
          </div>
        </div>

        {/* Fat Box */}
        <div className="rounded-2xl border-l-4 border-l-rose-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-rose-500 mb-1 flex items-center justify-center gap-1">
              <Droplet size={9} className="fill-rose-500" /> Tłuszcze (T)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.fat}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div
                className="bg-rose-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${fPct}%` }}
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(fPct)}% makro
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Macro Balance split progress bar */}
      {todayMacros.protein + todayMacros.carbs + todayMacros.fat > 0 && (
        <div className="mb-4 bg-surface-solid/10 border border-border-custom/30 rounded-xl p-2">
          <div className="h-2 w-full rounded-full bg-border-custom overflow-hidden flex">
            <div className="bg-primary h-full transition-all duration-700" style={{ width: `${pPct}%` }} title={`Białko: ${Math.round(pPct)}%`} />
            <div className="bg-amber-400 h-full transition-all duration-700" style={{ width: `${cPct}%` }} title={`Węglowodany: ${Math.round(cPct)}%`} />
            <div className="bg-rose-400 h-full transition-all duration-700" style={{ width: `${fPct}%` }} title={`Tłuszcze: ${Math.round(fPct)}%`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[8px] font-black text-text-muted uppercase tracking-wider">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Białko ({Math.round(pPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Węgle ({Math.round(cPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Tłuszcze ({Math.round(fPct)}%)</span>
          </div>
        </div>
      )}
    </>
  );
}
