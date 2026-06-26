import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { getTodayWarsaw } from '../../../lib/date'
import { MEAL_TYPES } from '../../../lib/foodLogging'
import { useHaptics } from '../../../hooks/useHaptics'

interface FoodEntry {
  id: string
  name: string
  brand: string | null
  calories: number | null
  protein: number | null
  amount: string | null
  meal_type: string | null
  meal_group_id: string | null
}

const MEAL_ORDER = MEAL_TYPES.map((m) => m.id)
const MEAL_LABEL: Record<string, string> = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m.label]))

function normalizeMealKey(raw: string | null | undefined) {
  const v = (raw || 'snack').toLowerCase().trim()
  return MEAL_ORDER.includes(v as (typeof MEAL_ORDER)[number]) ? v : 'snack'
}

export default function TodayMealsCard({
  session,
  refreshSignal,
  onEditEntry,
}: {
  session: Session
  refreshSignal?: number
  onEditEntry?: (entry: FoodEntry) => void
}) {
  const userId = session.user.id
  const today = getTodayWarsaw()
  const haptics = useHaptics()
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('daily_food_entries')
      .select('id, name, brand, calories, protein, amount, meal_type, meal_group_id')
      .eq('user_id', userId)
      .eq('date', today)
      .order('logged_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[TodayMealsCard]', error.message)
      setLoadError(error.message)
      setEntries([])
      return
    }
    setEntries((data as FoodEntry[]) ?? [])
  }, [userId, today])

  useEffect(() => { void load() }, [load, refreshSignal])

  const grouped = useMemo(() => {
    const byMeal: Record<string, FoodEntry[]> = {}
    for (const e of entries) {
      const key = normalizeMealKey(e.meal_type)
      ;(byMeal[key] ||= []).push(e)
    }

    const buildMealGroup = (mealKey: string, mealEntries: FoodEntry[]) => {
      const bundles = new Map<string, FoodEntry[]>()
      const singles: FoodEntry[] = []
      for (const e of mealEntries) {
        if (e.meal_group_id) {
          const arr = bundles.get(e.meal_group_id) ?? []
          arr.push(e)
          bundles.set(e.meal_group_id, arr)
        } else {
          singles.push(e)
        }
      }

      const items: Array<{ kind: 'bundle'; id: string; entries: FoodEntry[] } | { kind: 'single'; entry: FoodEntry }> = []
      for (const [gid, ents] of bundles) {
        if (ents.length > 1) items.push({ kind: 'bundle', id: gid, entries: ents })
        else singles.push(ents[0])
      }
      for (const s of singles) items.push({ kind: 'single', entry: s })

      const totalKcal = mealEntries.reduce((s, e) => s + (e.calories ?? 0), 0)
      const totalProtein = mealEntries.reduce((s, e) => s + (e.protein ?? 0), 0)

      return {
        mealKey,
        label: MEAL_LABEL[mealKey] || mealKey,
        items,
        totalKcal,
        totalProtein,
      }
    }

    const primary = MEAL_ORDER.map((mealKey) => {
      const mealEntries = byMeal[mealKey] || []
      if (!mealEntries.length) return null
      return buildMealGroup(mealKey, mealEntries)
    }).filter(Boolean) as Array<ReturnType<typeof buildMealGroup>>

    const extraKeys = Object.keys(byMeal).filter((k) => !MEAL_ORDER.includes(k as (typeof MEAL_ORDER)[number]))
    for (const key of extraKeys) {
      if (byMeal[key]?.length) primary.push(buildMealGroup(key, byMeal[key]))
    }

    return primary
  }, [entries])

  const deleteEntry = async (id: string) => {
    if (deletingId) return
    haptics.light()
    setDeletingId(id)
    try {
      const { error } = await supabase.rpc('remove_food_entry', { p_user_id: userId, p_entry_id: id })
      if (error) throw error
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/40 p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">Dzisiaj zjedzone</p>

      {loadError && (
        <p className="text-[11px] text-rose-500">Nie udało się wczytać: {loadError}</p>
      )}

      {!loadError && entries.length === 0 && (
        <p className="text-[12px] text-text-muted py-2">Brak wpisów — dodaj posiłek powyżej.</p>
      )}

      {!loadError && entries.length > 0 && grouped.length === 0 && (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border-custom/50 bg-background/30 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate">{e.name}</p>
                <p className="text-[10px] text-text-muted">{e.amount ?? '—'} · {e.calories ?? 0} kcal</p>
              </div>
              {onEditEntry && (
                <button type="button" onClick={() => onEditEntry(e)} className="p-1 text-text-muted hover:text-primary"><Pencil size={12} /></button>
              )}
              <button type="button" disabled={deletingId === e.id} onClick={() => deleteEntry(e.id)} className="p-1 text-text-muted hover:text-rose-500"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {grouped.map((meal) => (
        <div key={meal.mealKey} className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
            <span className="text-text-secondary">{meal.label}</span>
            <span>{Math.round(meal.totalKcal)} kcal · {Math.round(meal.totalProtein)}g B</span>
          </div>
          {meal.items.map((item) => {
            if (item.kind === 'single') {
              const e = item.entry
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border-custom/50 bg-background/30 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate">{e.name}</p>
                    <p className="text-[10px] text-text-muted">{e.amount ?? '—'} · {e.calories ?? 0} kcal</p>
                  </div>
                  {onEditEntry && (
                    <button type="button" onClick={() => onEditEntry(e)} className="p-1 text-text-muted hover:text-primary"><Pencil size={12} /></button>
                  )}
                  <button type="button" disabled={deletingId === e.id} onClick={() => deleteEntry(e.id)} className="p-1 text-text-muted hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
              )
            }

            const bundle = item
            const open = expandedGroups.has(bundle.id)
            const title = bundle.entries[0]?.name ?? 'Posiłek'
            const kcal = bundle.entries.reduce((s, e) => s + (e.calories ?? 0), 0)
            return (
              <div key={bundle.id} className="rounded-xl border border-border-custom/50 bg-background/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedGroups((p) => {
                    const n = new Set(p)
                    if (n.has(bundle.id)) n.delete(bundle.id); else n.add(bundle.id)
                    return n
                  })}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate">{title}{bundle.entries.length > 1 ? ` +${bundle.entries.length - 1}` : ''}</p>
                    <p className="text-[10px] text-text-muted">{bundle.entries.length} składniki · {kcal} kcal</p>
                  </div>
                  {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                </button>
                {open && (
                  <div className="border-t border-border-custom/40 px-2 py-1 space-y-1">
                    {bundle.entries.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 py-1">
                        <p className="flex-1 text-[11px] text-text-secondary truncate">{e.name}</p>
                        <span className="text-[10px] text-text-muted">{e.calories ?? 0}</span>
                        <button type="button" disabled={deletingId === e.id} onClick={() => deleteEntry(e.id)} className="text-text-muted hover:text-rose-500"><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
