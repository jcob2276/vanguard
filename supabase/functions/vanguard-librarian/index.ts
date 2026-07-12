/**
 * @function vanguard-librarian
 * @trigger Manual / cron / webhook
 * @role Bibliotekarz: oczyszcza i normalizuje wpisy o posiłkach bez dokładnych makr (llm_estimate) do bazy food_library, informując przez Telegram.
 * @reads daily_food_entries, food_library, food_corrections
 * @writes daily_food_entries, food_library
 * @calls deepseek-chat, api.telegram.org (bezpośrednio)
 * @consumer Powiadomienia w Telegramie i baza danych produktów
 * @status active
 */
import { createServiceClient } from '../_shared/supabase.ts'
import { serveJson } from '../_shared/http.ts'
import { deepseekChat, parseJsonFromContent } from '../_shared/deepseek.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { getVanguardUserId } from '../_shared/constants.ts'
// Force upload of domain package for shared dependencies
import type {} from "@vanguard/domain";

export async function runLibrarian() {
  const db = createServiceClient()
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || ''
  const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
  const tgChatId = Deno.env.get('TELEGRAM_CHAT_ID') || ''

  if (!apiKey || !tgToken || !tgChatId) {
    throw new Error('Missing config: DEEPSEEK_API_KEY, TELEGRAM_BOT_TOKEN, or TELEGRAM_CHAT_ID')
  }

  // 1. Fetch distinct llm_estimate entries from the last 7 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: rawEntries, error } = await db
    .from('daily_food_entries')
    .select('name, user_id')
    .gte('date', cutoffStr)
    .filter('parse_meta->>macroSource', 'eq', 'llm_estimate')

  const entries = rawEntries as Record<string, unknown>[] | null
  if (error || !entries || entries.length === 0) {
    return { count: 0, items: [] }
  }

  // Deduplicate by name
  const names = [...new Set(entries.map((e) => (e.name as string | undefined)?.trim()).filter(Boolean))]
  if (names.length === 0) return { count: 0, items: [] }

  const results: any[] = []

  // 2. Evaluate each with deepseek
  for (const name of names) {
    // Check if it's already in food_library or food_corrections
    const { data: existingLib } = await db.from('food_library').select('id').eq('name', name).limit(1)
    const { data: existingCorr } = await db.from('food_corrections').select('id').eq('query_name', name).limit(1)
    
    if (existingLib?.length || existingCorr?.length) {
      continue // Already resolved
    }

    const systemPrompt = `Jesteś zaawansowanym asystentem dietetycznym. 
Znajdź jak najdokładniejsze makroskładniki na 100g dla podanego produktu/potrawy (Polska kuchnia i produkty).
Zwróć poprawny JSON:
{"calories": 150, "protein": 5.5, "carbs": 20.0, "fat": 5.0, "fiber": 1.5, "sugar": 2.0}
Jeśli potrawa jest wysoce niestandardowa, spróbuj oszacować makro bazując na uśrednionym standardowym przepisie.`

    try {
      const response = await deepseekChat({
        apiKey,
        model: 'deepseek-chat',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Podaj makro na 100g dla: "${name}"` }
        ],
        responseFormat: { type: 'json_object' }
      })

      const macro = parseJsonFromContent(response.content) as Record<string, unknown> | null
      if (macro && typeof macro.calories === 'number') {
        const entryRow = entries.find(e => e.name === name)
        const insertData = {
          user_id: entryRow?.user_id || getVanguardUserId(),
          barcode: null,
          name: name,
          brand: '[AI Librarian]',
          calories: Math.round(macro.calories),
          protein: Number(macro.protein || 0),
          carbs: Number(macro.carbs || 0),
          fat: Number(macro.fat || 0),
          fiber: macro.fiber ? Number(macro.fiber) : null,
          sugar: macro.sugar ? Number(macro.sugar) : null,
          source_type: 'nutrition_label',
          is_public: false
        }
        
        results.push({ name, macro: insertData })
      }
    } catch (e: unknown) {
      console.error(`[librarian] Error resolving macro for ${name}:`, e);
      // Log and continue to process other items in the loop
    }
  }

  if (results.length === 0) return { count: 0, items: [] }

  // 3. Save to food_library
  for (const r of results) {
    // Actually we need to fetch user_id in the first query to do this properly
    const { data: userEntry } = await db.from('daily_food_entries').select('user_id').eq('name', r.name).limit(1).single()
    if (userEntry?.user_id) {
      r.macro.user_id = userEntry.user_id
      await db.from('food_library').insert(r.macro)
    }
  }

  // 4. Send Telegram message
  const tgLines = results.map(r => `- ${r.name}: ${r.macro.calories} kcal/100g (B:${r.macro.protein} W:${r.macro.carbs} T:${r.macro.fat})`)
  const tgMsg = `📚 *Bibliotekarz Vanguard*\n\nRozwiązałem ${results.length} wpisów \`llm_estimate\` z ostatniego tygodnia i dodałem je do Twojej bazy:\n\n${tgLines.join('\n')}`
  
  const chatId = parseInt(tgChatId, 10);
  await sendMessage(tgToken, chatId, tgMsg, { parseMode: 'Markdown' });

  return { count: results.length, items: results }
}

Deno.serve(serveJson(async () => {
  const result = await runLibrarian()
  return { ok: true, ...result }
}, { auth: 'service' }))
