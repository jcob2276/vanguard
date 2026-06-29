import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { notify } from '../../../lib/notify'
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../lib/date'
import { fetchNutritionDayContext } from '../../../lib/nutritionContext'
import {
  MEAL_TYPES,
  defaultMealType,
  ensureFoodStaples,
  fetchQuickFavorites,
  needsReview,
  parseFoodNL,
  quickAddFavorite,
  repeatYesterdayMeal,
  saveParsedFoodItems,
  type FoodFavoriteRow,
  type ParsedFoodItem,
  confidenceLabel,
} from '../../../lib/foodLogging'

interface FavoriteChip extends FoodFavoriteRow {}

export default function FoodQuickCapture({
  session,
  onSaved,
  onOpenFullModal,
  refreshSignal = 0,
}: {
  session: Session
  onSaved?: () => void
  onOpenFullModal?: () => void
  refreshSignal?: number
}) {
  const userId = session.user.id
  const draftKey = `vanguard_food_quick_draft_${userId}`
  // Survives a backgrounded-tab kill (Android frequently reclaims a PWA tab's memory) —
  // without this, switching apps mid-typing silently lost the unparsed meal description.
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey) || '' } catch { return '' }
  })
  const [mealType, setMealType] = useState(defaultMealType())
  const [logDate, setLogDate] = useState(() => getTodayWarsaw())
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    targetKcal: null as number | null,
    targetProtein: null as number | null,
    avgFoodQuality: null as number | null,
    foodQualityAnalysis: null as string | null,
  })
  const [qualityPending, setQualityPending] = useState(false)
  const [favorites, setFavorites] = useState<FavoriteChip[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<ParsedFoodItem[] | null>(null)
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const refreshContext = useCallback(async () => {
    const ctx = await fetchNutritionDayContext(userId, logDate, session.access_token)
    setTotals({
      calories: ctx.calories,
      protein: ctx.protein,
      targetKcal: ctx.targetKcal,
      targetProtein: ctx.targetProtein,
      avgFoodQuality: ctx.avgFoodQuality,
      foodQualityAnalysis: ctx.foodQualityAnalysis,
    })
  }, [userId, logDate, session.access_token])

  const bumpQualityRefresh = useCallback(() => {
    setQualityPending(true)
    window.setTimeout(() => { void refreshContext().then(() => setQualityPending(false)) }, 8000)
  }, [refreshContext])

  const loadFavorites = useCallback(async () => {
    await ensureFoodStaples(userId)
    setFavorites(await fetchQuickFavorites(userId, 8))
  }, [userId])

  useEffect(() => {
    void refreshContext()
    loadFavorites()
  }, [refreshContext, loadFavorites, refreshSignal])

  useEffect(() => {
    void refreshContext()
  }, [logDate, refreshContext])

  useEffect(() => {
    try {
      if (text.trim()) localStorage.setItem(draftKey, text)
      else localStorage.removeItem(draftKey)
    } catch { /* quota */ }
  }, [text, draftKey])

  const activePreview = preview?.filter((_, i) => !removed.has(i)) ?? []

  const handleParse = async () => {
    if (!text.trim() || parsing) return
    setParsing(true)
    setPreview(null)
    setRemoved(new Set())
    try {
      const items = await parseFoodNL(text, userId, session.access_token)
      if (!items.length) {
        notify('Nie rozpoznano produktów — spróbuj opisać inaczej', 'error')
        return
      }
      if (!needsReview(items)) {
        await saveParsedFoodItems(userId, items, { date: logDate, mealType })
        setText('')
        await refreshContext()
        bumpQualityRefresh()
        onSaved?.()
        notify(`Zapisano ${items.length} pozycji`, 'success')
        return
      }
      setPreview(items)
    } catch (e: any) {
      notify(e.message || 'Parsowanie nie powiodło się', 'error')
    } finally {
      setParsing(false)
    }
  }

  const handleSavePreview = async () => {
    if (!activePreview.length || saving) return
    setSaving(true)
    try {
      await saveParsedFoodItems(userId, activePreview, { date: logDate, mealType })
      setText('')
      setPreview(null)
      setRemoved(new Set())
      await refreshContext()
      bumpQualityRefresh()
      onSaved?.()
      notify(`Zapisano ${activePreview.length} pozycji`, 'success')
    } catch (e: any) {
      notify(e.message || 'Zapis nie powiódł się', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleFavorite = async (fav: FavoriteChip) => {
    if (saving) return
    setSaving(true)
    try {
      await quickAddFavorite(userId, fav, logDate, mealType)
      await refreshContext()
      await loadFavorites()
      bumpQualityRefresh()
      onSaved?.()
      notify(fav.name, 'success')
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRepeatYesterday = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await repeatYesterdayMeal(userId, logDate)
      if (!ok) {
        notify('Brak wpisów z wczoraj', 'error')
        return
      }
      await refreshContext()
      bumpQualityRefresh()
      onSaved?.()
      notify('Powtórzono pierwszy wpis z wczoraj', 'success')
    } catch (e: any) {
      notify(e.message || 'Błąd', 'error')
    } finally {
      setSaving(false)
    }
  }

  const today = getTodayWarsaw()
  const yesterday = getYesterdayWarsaw()

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">Posiłek</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setLogDate(today)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${logDate === today ? 'bg-primary text-white' : 'text-text-muted border border-border-custom'}`}
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={() => setLogDate(yesterday)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${logDate === yesterday ? 'bg-primary text-white' : 'text-text-muted border border-border-custom'}`}
          >
            Wczoraj
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
          <span>
            <span className="text-text-primary">{Math.round(totals.calories)}</span>
            {totals.targetKcal ? ` / ${totals.targetKcal}` : ''} kcal
          </span>
          {totals.targetProtein != null && (
            <span>
              <span className="text-text-primary">{Math.round(totals.protein)}</span> / {totals.targetProtein} g B
            </span>
          )}
        </div>
        {totals.targetKcal ? (
          <div className="h-1 rounded-full bg-border-custom overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totals.calories > totals.targetKcal ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, (totals.calories / totals.targetKcal) * 100)}%` }}
            />
          </div>
        ) : null}
        {(qualityPending || totals.avgFoodQuality != null || totals.foodQualityAnalysis) && (
          <p className="text-[10px] leading-snug text-text-muted">
            {qualityPending && !totals.foodQualityAnalysis ? (
              <span className="italic">Liczenie jakości…</span>
            ) : totals.avgFoodQuality != null ? (
              <>
                <span className={`font-black ${totals.avgFoodQuality >= 70 ? 'text-emerald-500' : totals.avgFoodQuality >= 45 ? 'text-amber-500' : 'text-rose-500'}`}>
                  Jakość {totals.avgFoodQuality}
                </span>
                {totals.foodQualityAnalysis ? (
                  <span>{' — '}{totals.foodQualityAnalysis.split(/[.!?]/)[0]?.trim()}</span>
                ) : null}
              </>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {MEAL_TYPES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMealType(m.id)}
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${mealType === m.id ? 'bg-primary/15 text-primary' : 'text-text-muted border border-border-custom/60'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); if (preview) setPreview(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } }}
          placeholder='np. 2 jajka, twaróg 150g, kawa'
          className="min-w-0 flex-1 rounded-xl border border-border-custom bg-background/50 px-3 py-2.5 text-[13px] outline-none focus:border-primary/40 placeholder:text-text-muted/40"
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={!text.trim() || parsing || saving}
          className="shrink-0 rounded-xl bg-primary px-3 py-2.5 text-white disabled:opacity-40"
          title="Parsuj i zapisz"
        >
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        </button>
      </div>

      {(favorites.length > 0 || logDate === today) && (
        <div className="flex flex-wrap gap-1.5">
          {favorites.map((f) => {
            const shortName = f.name.replace(/\s*\(\d+mg kofeiny\)/i, '')
            const label = f.is_pinned
              ? `★ ${shortName.length > 18 ? `${shortName.slice(0, 16)}…` : shortName}`
              : f.name.length > 22 ? `${f.name.slice(0, 20)}…` : f.name
            return (
            <button
              key={f.id}
              type="button"
              disabled={saving}
              onClick={() => handleFavorite(f)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                f.is_pinned
                  ? 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/15'
                  : 'border-border-custom bg-background/40 text-text-secondary hover:border-primary/30 hover:text-primary'
              }`}
              title={f.brand ? `${f.name} — ${f.brand}` : f.name}
            >
              {label}
            </button>
            )
          })}
          <button
            type="button"
            disabled={saving}
            onClick={handleRepeatYesterday}
            className="rounded-full border border-border-custom px-2.5 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary disabled:opacity-50 flex items-center gap-1"
          >
            <RotateCcw size={10} /> Wczoraj
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-2 border-t border-border-custom/50 pt-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Sprawdź przed zapisem</p>
          {preview.map((item, i) => {
            if (removed.has(i)) return null
            const badge = confidenceLabel(item)
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border-custom/60 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-text-muted">{item.grams}g · {item.calories} kcal · {item.protein}B</p>
                  {item.assumptions?.length ? (
                    <p className="text-[9px] text-amber-600/90 mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p>
                  ) : null}
                </div>
                {badge && (
                  <span className={`text-[9px] font-bold uppercase ${badge === 'sprawdź' ? 'text-amber-500' : 'text-emerald-500'}`}>{badge}</span>
                )}
                <button type="button" onClick={() => setRemoved((p) => new Set([...p, i]))} className="text-[10px] text-text-muted hover:text-rose-500">×</button>
              </div>
            )
          })}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setPreview(null); setRemoved(new Set()); }} className="flex-1 rounded-xl border border-border-custom py-2 text-[11px] font-bold text-text-muted">Anuluj</button>
            <button type="button" onClick={handleSavePreview} disabled={!activePreview.length || saving} className="flex-1 rounded-xl bg-primary py-2 text-[11px] font-bold text-white disabled:opacity-50">
              {saving ? 'Zapisuję…' : `Zapisz (${activePreview.length})`}
            </button>
          </div>
        </div>
      )}

      {onOpenFullModal && (
        <button type="button" onClick={onOpenFullModal} className="text-[10px] font-semibold text-primary/80 hover:text-primary">
          Skaner / wyszukiwarka →
        </button>
      )}
    </div>
  )
}
