import { X, Flame } from 'lucide-react';
import { TodoSlot } from './types';
import { PRIORITY_COLORS } from './useMorningPlanData';
import Button from '../../ui/Button';

interface Props {
  powerList: (TodoSlot | null)[];
  todayTasks: TodoSlot[];
  inboxTasks: TodoSlot[];
  nutritionTarget: { target_kcal: number | null; protein_floor_g: number | null } | null;
  dayWord: string;
  dayWordAcc: string;
  activeSlotIdx: number | null;
  setActiveSlotIdx: (idx: number | null) => void;
  onAssign: (task: TodoSlot) => void;
  onClear: (idx: number) => void;
}

export default function MorningPlanStep2PowerList({
  powerList,
  todayTasks,
  inboxTasks,
  nutritionTarget,
  dayWord,
  dayWordAcc,
  activeSlotIdx,
  setActiveSlotIdx,
  onAssign,
  onClear,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-text-primary">Twoja {dayWordAcc} Power List</h3>
        <p className="text-xs text-text-muted mt-0.5">Wybierz 3-5 najważniejszych zadań (Zwycięstw) na {dayWord}.</p>
      </div>

      {/* Power List slots */}
      {nutritionTarget && (
        <div className="bg-success/5 dark:bg-success/10 border border-success/10 dark:border-success/30 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
              <Flame size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-success block uppercase tracking-wider">Dzienny Cel Żywieniowy</span>
              <span className="text-sm text-text-primary font-bold">
                {nutritionTarget.target_kcal ? `${nutritionTarget.target_kcal} kcal` : '—'} 
                <span className="text-text-muted font-normal mx-1.5">|</span>
                {nutritionTarget.protein_floor_g ? `min. ${nutritionTarget.protein_floor_g}g białka` : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 p-3 rounded-2xl">
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider block mb-1">Sloty Power List</span>
        {powerList.map((slot, idx) => (
          <div
            key={idx}
            onClick={() => setActiveSlotIdx(idx)}
            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              activeSlotIdx === idx
                ? 'border-primary bg-primary/5 shadow-sm'
                : slot
                ? 'border-border-custom/40 bg-surface'
                : 'border-dashed border-border-custom/60 bg-transparent hover:bg-surface/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-border-custom/30 flex items-center justify-center text-xs font-bold text-text-muted">
                {idx + 1}
              </div>
              <span className={`text-sm font-semibold ${slot ? 'text-text-primary' : 'text-text-muted/50 italic'}`}>
                {slot ? slot.title : 'Wybierz zadanie do tego slotu...'}
              </span>
            </div>
            {slot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear(idx);
                }}
                icon={<X size={14} />}
                className="!p-1 hover:!text-danger"
              />
            )}
          </div>
        ))}
      </div>

      {/* Selection list */}
      <div className="space-y-2">
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider block">Dostępne zadania na {dayWord} i Inbox</span>
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {[...todayTasks, ...inboxTasks].length === 0 ? (
            <p className="text-xs text-text-muted italic py-4 text-center">Brak wolnych zadań</p>
          ) : (
            [...todayTasks, ...inboxTasks].map((task) => {
              const isUsed = powerList.some((s) => s?.id === task.id);
              return (
                <Button
                  key={task.id}
                  disabled={isUsed || activeSlotIdx === null}
                  onClick={() => onAssign(task)}
                  variant="outline"
                  size="sm"
                  className={`w-full text-left !justify-between ${
                    isUsed
                      ? '!opacity-40 !border-border-custom/20 !bg-surface-solid/10'
                      : activeSlotIdx !== null
                      ? '!border-primary/40 hover:!border-primary hover:!bg-primary/[0.02]'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-2xs font-black ${PRIORITY_COLORS[task.priority] || 'text-text-muted'}`}>
                      {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : '·'}
                    </span>
                    <span className="text-sm font-semibold text-text-primary truncate">{task.title}</span>
                  </div>
                  {task.duration_minutes && (
                    <span className="text-2xs font-bold text-text-muted bg-border-custom/20 px-1.5 py-0.5 rounded shrink-0">
                      {task.duration_minutes}m
                    </span>
                  )}
                </Button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
