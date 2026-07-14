import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { Card } from '../ui/Card';
import { notify } from '../../lib/notify';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  LIFE_SPHERES,
  fetchSphereBudgets,
  saveSphereBudget,
  fetchWeeklySphereActuals,
  type SphereHours,
  type LifeSphereId,
} from '../../lib/projects/lifeSpheres';
import { getWeekStartWarsaw, shiftWeekStart, formatWeekRange, isCurrentWeek } from '../../lib/growth/growth';
import { getTodayWarsaw } from '../../lib/date';
import { listTodoItems, updateTodoItem } from '../../lib/todo/todo';
import type { Database } from '../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
type BudgetBounds = { min: number | null; max: number | null };

function emptyBudgetMap(): Record<LifeSphereId, BudgetBounds> {
  return Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, { min: null, max: null }])) as Record<LifeSphereId, BudgetBounds>;
}

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 100;

function polarPoint(index: number, radiusFraction: number) {
  const angle = index * ((2 * Math.PI) / 6) - Math.PI / 2;
  const r = RADIUS * Math.max(0, Math.min(1, radiusFraction));
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(values: number[], scale: number) {
  return values.map((v, i) => {
    const p = polarPoint(i, scale > 0 ? v / scale : 0);
    return `${p.x},${p.y}`;
  }).join(' ');
}

/**
 * "Architektura Tygodnia" — budget (target hours) vs actual hours per life
 * sphere, on the same 6-axis hexagon shape as HexagonPanel's self-rating
 * "Heksagon życia", but a different tool: this one plots real hours from
 * vanguard_calendar + completed todo_items against vanguard_time_budgets,
 * not a subjective 1-10 score. Budgets read/write the same table CalendarView's
 * budget bars use, so the two views can never drift apart.
 */
export default function WeeklyBalanceHexagon({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getWeekStartWarsaw(getTodayWarsaw()));
  const [editingSphere, setEditingSphere] = useState<LifeSphereId | null>(null);
  const [draftHours, setDraftHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const dataQuery = useQuery({
    queryKey: ['weekly-balance-hexagon', userId, weekStart],
    queryFn: async () => {
      const [budgetRows, actualHours, items] = await Promise.all([
        fetchSphereBudgets(userId),
        fetchWeeklySphereActuals(userId, weekStart),
        listTodoItems(userId),
      ]);
      const map = emptyBudgetMap();
      budgetRows.forEach((b) => {
        if (b.category in map) map[b.category as LifeSphereId] = { min: b.min_hours, max: b.max_hours };
      });
      return { budgets: map, actuals: actualHours, tasks: items.filter((t) => t.status === 'open' && t.is_important) };
    },
    enabled: !!userId,
  });

  const budgets = dataQuery.data?.budgets ?? emptyBudgetMap();
  const actuals = dataQuery.data?.actuals ?? null;
  const tasks = dataQuery.data?.tasks ?? [];
  const loading = dataQuery.isLoading;

  const targetFor = useCallback(
    (sphere: LifeSphereId) => budgets[sphere]?.max ?? budgets[sphere]?.min ?? 0,
    [budgets],
  );

  const axisScale = useMemo(() => {
    const values = LIFE_SPHERES.flatMap((s) => [targetFor(s.id), actuals?.[s.id] ?? 0]);
    return Math.max(6, ...values) * 1.15;
  }, [targetFor, actuals]);

  const budgetPoints = useMemo(
    () => polygonPoints(LIFE_SPHERES.map((s) => targetFor(s.id)), axisScale),
    [targetFor, axisScale],
  );
  const actualPoints = useMemo(
    () => polygonPoints(LIFE_SPHERES.map((s) => actuals?.[s.id] ?? 0), axisScale),
    [actuals, axisScale],
  );

  const startEditing = (sphere: LifeSphereId) => {
    setEditingSphere(sphere);
    setDraftHours(budgets[sphere]?.max != null ? String(budgets[sphere].max) : '');
  };

  const saveTarget = async () => {
    if (!editingSphere) return;
    setSaving(true);
    try {
      const hours = draftHours.trim() === '' ? null : Number(draftHours);
      const currentMin = budgets[editingSphere]?.min ?? null;
      await saveSphereBudget(userId, editingSphere, currentMin, hours);
      queryClient.setQueryData(
        ['weekly-balance-hexagon', userId, weekStart],
        (old: { budgets: Record<LifeSphereId, BudgetBounds>; actuals: SphereHours | null; tasks: TodoItemRow[] } | undefined) => {
          if (!old) return old;
          return { ...old, budgets: { ...old.budgets, [editingSphere]: { min: currentMin, max: hours } } };
        }
      );
      setEditingSphere(null);
    } catch (err: unknown) { notify('Nie udało się zapisać budżetu.', 'error'); console.warn('[WeeklyBalanceHexagon] Failed to save sphere budget:', err); } finally {
      setSaving(false);
    }
  };

  const assignSelectedTask = async (sphere: LifeSphereId) => {
    if (!selectedTaskId || assigning) return;
    setAssigning(true);
    const taskId = selectedTaskId;
    queryClient.setQueryData(
      ['weekly-balance-hexagon', userId, weekStart],
      (old: { budgets: Record<LifeSphereId, BudgetBounds>; actuals: SphereHours | null; tasks: TodoItemRow[] } | undefined) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.map((t) => (t.id === taskId ? { ...t, category: sphere } : t)) };
      }
    );
    try {
      await updateTodoItem(taskId, { category: sphere });
    } catch (err: unknown) { notify('Nie udało się przypisać zadania do obszaru.', 'error'); console.warn('[WeeklyBalanceHexagon] Failed to update todo category:', err); } finally {
      setSelectedTaskId(null);
      setAssigning(false);
    }
  };

  return (
    <Card padding="1rem" className="space-y-4" style={{ background: 'var(--legacy-color-102)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-text-primary">Architektura Tygodnia</p>
          <p className="text-xs text-text-muted">Budżet (kontur) vs realny czas (wypełnienie) per sfera</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Pressable
            type="button"
            onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))}
            className="p-1.5 rounded-lg border border-border-custom/50 text-text-muted hover:text-text-primary transition-colors btn-press"
          >
            <ChevronLeft size={14} />
          </Pressable>
          <span className="text-xs font-bold text-text-secondary min-w-[var(--legacy-w-094)] text-center">
            {formatWeekRange(weekStart)}{isCurrentWeek(weekStart) ? ' • dziś' : ''}
          </span>
          <Pressable
            type="button"
            onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))}
            className="p-1.5 rounded-lg border border-border-custom/50 text-text-muted hover:text-text-primary transition-colors btn-press"
          >
            <ChevronRight size={14} />
          </Pressable>
        </div>
      </div>

      <div className="flex justify-center">
        {loading ? (
          <div className="h-[var(--legacy-h-020)] w-[var(--legacy-w-083)] animate-pulse rounded-full bg-surface border border-border-custom" />
        ) : (
          <svg width={SIZE} height={SIZE} className="overflow-visible">
            {[0.25, 0.5, 0.75, 1].map((k) => (
              <polygon
                key={k}
                points={LIFE_SPHERES.map((_, i) => { const p = polarPoint(i, k); return `${p.x},${p.y}`; }).join(' ')}
                fill="none"
                stroke="currentColor"
                className="text-border-custom"
                strokeWidth={1}
                strokeDasharray={k === 1 ? 'none' : '2,3'}
              />
            ))}
            {LIFE_SPHERES.map((_, i) => {
              const p = polarPoint(i, 1);
              return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="currentColor" className="text-border-custom" strokeWidth={1} />;
            })}

            <polygon points={budgetPoints} fill="none" stroke="var(--primary)" strokeWidth={2} strokeDasharray="4,3" />
            <polygon points={actualPoints} fill="var(--primary-18)" stroke="var(--primary-80)" strokeWidth={2} />

            {LIFE_SPHERES.map((s, i) => {
              const p = polarPoint(i, 1.28);
              return (
                <text
                  key={s.id}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  className="text-2xs font-black uppercase tracking-wider fill-text-primary cursor-pointer"
                  onClick={() => (selectedTaskId ? assignSelectedTask(s.id) : startEditing(s.id))}
                >
                  {s.label}
                </text>
              );
            })}
          </svg>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {LIFE_SPHERES.map((s) => (
          <Pressable
            key={s.id}
            type="button"
            onClick={() => (selectedTaskId ? assignSelectedTask(s.id) : startEditing(s.id))}
            className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors btn-press ${
              selectedTaskId ? `${s.border} ${s.bgSoft} ${s.text}` : 'border-border-custom/40 text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
              {s.label}
            </span>
            <span className="text-text-muted shrink-0">
              {(actuals?.[s.id] ?? 0).toFixed(1)}h{targetFor(s.id) > 0 ? ` / ${targetFor(s.id)}h` : ''}
            </span>
          </Pressable>
        ))}
      </div>

      {editingSphere && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
          <span className="text-xs font-bold text-text-primary flex-1">
            Cel godzin/tydzień: {LIFE_SPHERES.find((s) => s.id === editingSphere)?.label}
          </span>
          <ControlInput
            type="number"
            min={0}
            step={0.5}
            autoFocus
            value={draftHours}
            onChange={(e) => setDraftHours(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveTarget(); }}
            className="w-16 rounded-lg border border-border-custom/50 bg-surface-solid/60 px-2 py-1 text-xs text-text-primary outline-none focus:border-primary/30"
          />
          <Pressable
            variant="primary"
            size="sm"
            type="button"
            onClick={() => void saveTarget()}
            disabled={saving}
            loading={saving}
            className="rounded-lg px-2.5 py-1 text-xs font-black btn-press"
          >
            Zapisz
          </Pressable>
          <Pressable
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setEditingSphere(null)}
            className="text-xs font-semibold text-text-muted hover:text-text-primary"
          >
            Anuluj
          </Pressable>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-text-muted">
            {selectedTaskId ? 'Wybierz sferę powyżej, żeby przypisać zadanie ↑' : 'Priorytetowe zadania — dotknij, potem wybierz sferę'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tasks.map((t) => {
              const sphere = LIFE_SPHERES.find((s) => s.id === t.category);
              const isSelected = selectedTaskId === t.id;
              return (
                <Pressable
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTaskId(isSelected ? null : t.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors btn-press ${
                    isSelected
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border-custom/50 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {sphere && <span className={`h-1.5 w-1.5 rounded-full ${sphere.dot}`} />}
                  {t.title}
                  {isSelected && <Check size={10} />}
                </Pressable>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
