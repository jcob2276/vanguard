import { deepseekChat, parseJsonFromContent } from '../../_shared/deepseek.ts'
import { safeSendTelegram } from '../_utils/helpers.ts'

export async function handleMealCorrection(
  replyToText: string,
  correctionText: string,
  userId: string,
  supabase: any,
  telegramToken: string,
  chatId: number,
  deepseekApiKey: string,
): Promise<boolean> {
  const systemPrompt = `Jesteś precyzyjnym parserem korekt posiłków. 
Otrzymujesz podsumowanie zapisanego posiłku oraz poprawkę użytkownika.
Zidentyfikuj, który produkt z listy jest poprawiany lub usuwany. Ustal nową gramaturę (w gramach) lub nowe kalorie (w kcal), lub nową nazwę.

Podsumowanie posiłku:
${replyToText}

Poprawka użytkownika:
"${correctionText}"

Zwróć poprawny JSON (wyłącznie JSON, bez markdownu):
{
  "target_name": "dokładna nazwa produktu z oryginalnego zapisu, który należy poprawić lub usunąć (np. 'Kebab')",
  "action": "update|delete",
  "corrected_name": "nowa nazwa jeśli użytkownik ją zmienia (np. 'Kebab drobiowy'), inaczej null",
  "corrected_grams": nowa gramatura jako liczba całkowita lub null,
  "corrected_calories": nowe kalorie jako liczba całkowita lub null
}`

  try {
    const response = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-chat',
      temperature: 0.1,
      messages: [{ role: 'user', content: systemPrompt }],
      responseFormat: { type: 'json_object' }
    })

    const parsed = parseJsonFromContent(response.content) as {
      target_name?: string
      action?: 'update' | 'delete'
      corrected_name?: string | null
      corrected_grams?: number | null
      corrected_calories?: number | null
    }

    if (!parsed || !parsed.target_name || !parsed.action) {
      return false
    }

    const target = parsed.target_name.trim()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

    // Find the entry in daily_food_entries matching today or yesterday
    let { data: entries, error: fetchErr } = await supabase
      .from('daily_food_entries')
      .select('*')
      .eq('user_id', userId)
      .in('date', [today, yesterday])
      .order('logged_at', { ascending: false })

    if (fetchErr || !entries || entries.length === 0) {
      await safeSendTelegram(chatId, '❌ Nie znalazłem żadnych dzisiejszych ani wczorajszych posiłków do poprawy.', telegramToken)
      return true
    }

    // Find the closest name match
    const entry = entries.find((e: any) => e.name.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(e.name.toLowerCase()))
    if (!entry) {
      await safeSendTelegram(chatId, `❌ Nie znalazłem produktu "${target}" w zapisanych posiłkach.`, telegramToken)
      return true
    }

    if (parsed.action === 'delete') {
      const { error: delErr } = await supabase.from('daily_food_entries').delete().eq('id', entry.id)
      if (delErr) throw delErr

      await supabase.rpc('_recompute_daily_nutrition', { p_user_id: userId, p_date: entry.date })
      await safeSendTelegram(chatId, `🗑 Usunąłem z bazy posiłek: "${entry.name}".`, telegramToken)
      return true
    }

    // Update logic
    let factor = 1
    let newGrams = entry.amount ? parseInt(entry.amount, 10) : 100
    if (isNaN(newGrams)) newGrams = 100

    if (parsed.corrected_grams) {
      factor = parsed.corrected_grams / newGrams
      newGrams = parsed.corrected_grams
    }

    let newCalories = entry.calories
    if (parsed.corrected_calories) {
      if (!parsed.corrected_grams) {
        factor = parsed.corrected_calories / entry.calories
      }
      newCalories = parsed.corrected_calories
    } else if (parsed.corrected_grams) {
      newCalories = Math.round(entry.calories * factor)
    }

    const newProtein = Math.round(Number(entry.protein || 0) * factor * 10) / 10
    const newCarbs = Math.round(Number(entry.carbs || 0) * factor * 10) / 10
    const newFat = Math.round(Number(entry.fat || 0) * factor * 10) / 10
    const newFiber = entry.fiber ? Math.round(Number(entry.fiber) * factor * 10) / 10 : null
    const newSugar = entry.sugar ? Math.round(Number(entry.sugar) * factor * 10) / 10 : null
    const newName = parsed.corrected_name || entry.name

    const { error: updateErr } = await supabase
      .from('daily_food_entries')
      .update({
        name: newName,
        amount: `${newGrams} g`,
        calories: newCalories,
        protein: newProtein,
        carbs: newCarbs,
        fat: newFat,
        fiber: newFiber,
        sugar: newSugar,
        parse_meta: {
          macroSource: 'user_correction',
          parserVersion: '2026-06-28',
          originalValue: {
            name: entry.name,
            amount: entry.amount,
            calories: entry.calories
          }
        }
      })
      .eq('id', entry.id)

    if (updateErr) throw updateErr

    // Also update/insert to food_library so it is persistent!
    // We scale macros to 100g to keep the library representation correct
    const scale100 = newGrams > 0 ? 100 / newGrams : 1
    const libCalories = Math.round(newCalories * scale100)
    const libProtein = Math.round(newProtein * scale100 * 10) / 10
    const libCarbs = Math.round(newCarbs * scale100 * 10) / 10
    const libFat = Math.round(newFat * scale100 * 10) / 10
    const libFiber = newFiber ? Math.round(newFiber * scale100 * 10) / 10 : null
    const libSugar = newSugar ? Math.round(newSugar * scale100 * 10) / 10 : null

    // Fetch original query to log it in food_corrections
    let queryName = entry.name
    const { data: lastStream } = await supabase
      .from('vanguard_stream')
      .select('content')
      .eq('user_id', userId)
      .eq('source', 'telegram')
      .order('created_at', { ascending: false })
      .limit(2)

    if (lastStream && lastStream.length > 0) {
      // Find one that was likely the meal text
      const candidate = lastStream.find((s: any) => !s.content.startsWith('/') && !s.content.startsWith('?'))
      if (candidate) {
        queryName = candidate.content.trim()
      }
    }

    // Insert to food_corrections
    await supabase.from('food_corrections').insert({
      user_id: userId,
      query_name: queryName,
      corrected_name: newName,
      corrected_grams: newGrams
    })

    // Upsert into food_library
    await supabase.from('food_library').upsert({
      user_id: userId,
      name: newName,
      brand: '[User Telegram Correction]',
      calories: libCalories,
      protein: libProtein,
      carbs: libCarbs,
      fat: libFat,
      fiber: libFiber,
      sugar: libSugar,
      default_grams: newGrams,
      source: 'manual'
    }, { onConflict: 'user_id,name,brand' })

    await supabase.rpc('_recompute_daily_nutrition', { p_user_id: userId, p_date: entry.date })

    const confirmationMsg = `✍️ *Poprawiono posiłek: "${newName}"*\n` +
      `• Przed: ${entry.name} — ${entry.amount} — ${entry.calories} kcal\n` +
      `• Po: ${newName} — ${newGrams}g — ${newCalories} kcal\n\n` +
      `Zaktualizowałem bazę i zapamiętałem regułę w \`food_corrections\` oraz \`food_library\`.`

    await safeSendTelegram(chatId, confirmationMsg, telegramToken, { parse_mode: 'Markdown' })
    return true
  } catch (err) {
    console.error('[foodCorrection] Error updating entry:', err)
    await safeSendTelegram(chatId, `❌ Wystąpił błąd podczas zapisywania poprawki: ${err.message}`, telegramToken)
    return true
  }
}
