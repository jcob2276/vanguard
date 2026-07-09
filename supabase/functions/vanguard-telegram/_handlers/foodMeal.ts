import { ackCallback } from '../_utils/callbackAck.ts'
import { safeSendTelegram } from '../_utils/helpers.ts'
import { fetchWorldState } from '../../_shared/worldState.ts'
import {
  needsFoodReview,
  type ParsedFoodItem,
} from '../../_shared/foodParseCore.ts'

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
}

const PENDING_TTL_MS = 30 * 60 * 1000

export function isFoodMealCallback(data: string): boolean {
  return data.startsWith('food_save:') || data.startsWith('food_cancel:')
}

function sourceTag(item: ParsedFoodItem): string {
  if (item.source === 'library') return '📚'
  if (item.source === 'database') return '🗂'
  if (item.confidence === 'low') return '⚠️'
  if (item.confidence === 'medium') return '~'
  return '✓'
}

function formatFoodPreviewMessage(
  items: ParsedFoodItem[],
  mealType: string,
): string {
  const label = MEAL_TYPE_LABELS[mealType] ?? mealType
  const lines = items.map((item) => {
    const tag = sourceTag(item)
    const note = item.assumptions?.[0]
    return `${tag} ${item.name} — ${item.grams}g — ${item.calories} kcal${note ? `\n   ↳ ${note}` : ''}`
  })
  const total = items.reduce((s, i) => s + i.calories, 0)
  return `🍽 Podgląd (${label}):\n${lines.join('\n')}\nRazem: ${total} kcal\n\nSprawdź i zapisz, albo anuluj.`
}

async function saveParsedFoodEntries(
  supabase: any,
  userId: string,
  date: string,
  mealType: string,
  items: ParsedFoodItem[],
): Promise<{ name: string; grams: number; calories: number }[]> {
  const mealGroupId = items.length > 1 ? crypto.randomUUID() : null
  const logged: { name: string; grams: number; calories: number }[] = []

  for (const item of items) {
    const scale100 = item.grams > 0 ? 100 / item.grams : 1
    const { error } = await supabase.rpc('add_food_entry', {
      p_user_id: userId,
      p_date: date,
      p_grams: item.grams,
      p_entry: {
        name: item.name,
        brand: null,
        barcode: null,
        calories: Math.round(item.calories * scale100),
        protein: Math.round(item.protein * scale100 * 10) / 10,
        carbs: item.carbs != null ? Math.round(item.carbs * scale100 * 10) / 10 : null,
        fat: item.fat != null ? Math.round(item.fat * scale100 * 10) / 10 : null,
        fiber: item.fiber != null ? Math.round(Number(item.fiber) * scale100 * 10) / 10 : null,
        sugar: item.sugar != null ? Math.round(Number(item.sugar) * scale100 * 10) / 10 : null,
        meal_type: mealType,
        meal_group_id: mealGroupId,
        parse_meta: item.parseMeta ?? null,
      },
    })
    if (error) {
      console.error('[foodMeal] add_food_entry failed for', item.name, error)
      continue
    }
    logged.push({ name: item.name, grams: item.grams, calories: item.calories })
  }

  return logged
}

async function pruneStalePending(supabase: any, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString()
  await supabase
    .from('food_parse_pending')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', cutoff)
}

async function storePendingFoodLog(
  supabase: any,
  userId: string,
  date: string,
  mealType: string,
  items: ParsedFoodItem[],
): Promise<string> {
  await pruneStalePending(supabase, userId)
  const { data, error } = await supabase
    .from('food_parse_pending')
    .insert({
      user_id: userId,
      log_date: date,
      meal_type: mealType,
      items,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Nie udało się zapisać podglądu posiłku')
  }
  return data.id as string
}

async function loadPendingFoodLog(
  supabase: any,
  userId: string,
  pendingId: string,
): Promise<{ date: string; mealType: string; items: ParsedFoodItem[] } | null> {
  const { data, error } = await supabase
    .from('food_parse_pending')
    .select('log_date, meal_type, items, created_at')
    .eq('id', pendingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const createdAt = new Date(data.created_at as string).getTime()
  if (Date.now() - createdAt > PENDING_TTL_MS) {
    await supabase.from('food_parse_pending').delete().eq('id', pendingId)
    return null
  }

  const items = Array.isArray(data.items) ? data.items as ParsedFoodItem[] : []
  if (!items.length) return null

  return {
    date: data.log_date as string,
    mealType: data.meal_type as string,
    items,
  }
}

async function deletePendingFoodLog(supabase: any, pendingId: string): Promise<void> {
  await supabase.from('food_parse_pending').delete().eq('id', pendingId)
}



export async function handleFoodMealCallback(
  callbackData: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  userId: string,
): Promise<void> {
  await ackCallback(telegramToken, callbackId, chatId, messageId)

  const [action, pendingId] = callbackData.split(':')
  if (!pendingId) {
    await safeSendTelegram(chatId, '⚠️ Nieprawidłowy podgląd posiłku.', telegramToken)
    return
  }

  if (action === 'food_cancel') {
    await deletePendingFoodLog(supabase, pendingId)
    await safeSendTelegram(chatId, 'Anulowano zapis posiłku.', telegramToken)
    return
  }

  if (action !== 'food_save') return

  const pending = await loadPendingFoodLog(supabase, userId, pendingId)
  if (!pending) {
    await safeSendTelegram(chatId, '⚠️ Podgląd wygasł — wpisz posiłek ponownie.', telegramToken)
    return
  }

  const logged = await saveParsedFoodEntries(
    supabase,
    userId,
    pending.date,
    pending.mealType,
    pending.items,
  )
  await deletePendingFoodLog(supabase, pendingId)

  if (!logged.length) {
    await safeSendTelegram(chatId, '❌ Nie udało się zapisać posiłku.', telegramToken)
    return
  }

  // Invalidate world state cache
  fetchWorldState(supabase, userId, pending.date, undefined, true).catch((e) => {
    console.error("[telegram] fetchWorldState forceRefresh failed:", e);
  });

  const total = logged.reduce((sum, l) => sum + l.calories, 0)
  const lines = logged.map((l) => `• ${l.name} — ${l.grams}g — ${l.calories} kcal`).join('\n')
  const label = MEAL_TYPE_LABELS[pending.mealType] ?? pending.mealType
  await safeSendTelegram(
    chatId,
    `🍽 Zapisano (${label}):\n${lines}\nRazem: ${total} kcal`,
    telegramToken,
  )
}

export async function sendFoodParseResult(
  items: ParsedFoodItem[],
  opts: {
    chatId: number
    telegramToken: string
    supabase: any
    userId: string
    date: string
    mealType: string
    replyKeyboard?: object
  },
): Promise<void> {
  const { chatId, telegramToken, supabase, userId, date, mealType, replyKeyboard } = opts

  if (needsFoodReview(items)) {
    const pendingId = await storePendingFoodLog(supabase, userId, date, mealType, items)
    await safeSendTelegram(
      chatId,
      formatFoodPreviewMessage(items, mealType),
      telegramToken,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Zapisz', callback_data: `food_save:${pendingId}` },
            { text: '❌ Anuluj', callback_data: `food_cancel:${pendingId}` },
          ]],
        },
      },
    )
    return
  }

  const logged = await saveParsedFoodEntries(supabase, userId, date, mealType, items)
  if (!logged.length) {
    await safeSendTelegram(chatId, '❌ Nie udało się zapisać posiłku.', telegramToken, { reply_markup: replyKeyboard })
    return
  }

  // Invalidate world state cache
  fetchWorldState(supabase, userId, date, undefined, true).catch((e) => {
    console.error("[telegram] fetchWorldState forceRefresh failed:", e);
  });

  const total = logged.reduce((sum, l) => sum + l.calories, 0)
  const lines = logged.map((l) => `• ${l.name} — ${l.grams}g — ${l.calories} kcal`).join('\n')
  const label = MEAL_TYPE_LABELS[mealType] ?? mealType
  await safeSendTelegram(
    chatId,
    `🍽 Zapisano (${label}):\n${lines}\nRazem: ${total} kcal`,
    telegramToken,
    { reply_markup: replyKeyboard },
  )
}
