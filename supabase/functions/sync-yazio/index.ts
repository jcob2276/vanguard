import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as YazioLib from "https://esm.sh/yazio"
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'
const { Yazio } = YazioLib

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const { userId, sync_history, days } = await req.json().catch(() => ({ userId: null, sync_history: false, days: null }))
    if (!userId) throw new Error('Missing userId')

    const settings = await safeExecute(
      supabase.from('user_settings').select('yazio_username, yazio_password').eq('user_id', userId).single()
    )
    if (!settings?.yazio_username) throw new Error('Missing credentials')

    const yazio = new Yazio({ credentials: { username: settings.yazio_username, password: settings.yazio_password } })
    await yazio.user.get(); 
    const yazioToken = (yazio as any)._token || (yazio as any).credentials?.password;

    const daysToSync = days || (sync_history ? 30 : 1)
    const results = []
    const productCache: Record<string, string> = {};

    const formatter = new Intl.DateTimeFormat('sv', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const warsawTodayStr = formatter.format(new Date());

    for (let i = 0; i < daysToSync; i++) {
      const targetDate = new Date(`${warsawTodayStr}T12:00:00Z`);
      if (i > 0) {
        targetDate.setUTCDate(targetDate.getUTCDate() - i);
      }
      const dateStr = targetDate.toISOString().split('T')[0]

      try {
        let foodEntries: any[] = [];
        let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, totalSugar = 0;

        console.log(`[Yazio] Syncing ${dateStr}...`);
        const consumed: any = await yazio.user.getConsumedItems({ date: targetDate });
        const items = [...(consumed.products || []), ...(consumed.recipe_portions || []), ...(consumed.simple_products || [])];

        for (const item of items) {
          let name = item.name || item.product?.name || item.recipe?.name || item.food?.name || item.title;
          let nutrients = item.nutrients || {};

          if ((!name || !nutrients["energy.energy"]) && item.product_id) {
            const cacheKey = `p_${item.product_id}`;
            if (productCache[cacheKey]) {
              const cachedData = JSON.parse(productCache[cacheKey]);
              name = cachedData.name; nutrients = cachedData.nutrients;
            } else {
              try {
                const pRes = await fetch(`https://yzapi.yazio.com/v15/products/${item.product_id}`, {
                    headers: { "Authorization": `Bearer ${yazioToken}`, "User-Agent": "YAZIO/Android" }
                });
                if (pRes.ok) {
                  const pInfo = await pRes.json();
                  name = pInfo.name;
                  nutrients = pInfo.nutrients || {};
                  productCache[cacheKey] = JSON.stringify({ name, nutrients });
                }
              } catch (e) { console.log(`[Yazio] Fetch failed for ${item.product_id}:`, e.message); }
            }
          }

          if (!name) name = 'Unknown Item';
          const amount = parseFloat(item.amount ?? item.serving_quantity) || 0;
          let p = nutrients["nutrient.protein"] || 0;
          let w = nutrients["nutrient.carb"] || 0;
          let t = nutrients["nutrient.fat"] || 0;
          let f = nutrients["nutrient.dietaryfiber"] || 0;
          let s = nutrients["nutrient.sugar"] || 0;

          if (item.product_id && amount > 0 && !nutrients._scaled) {
             p = p * amount;
             w = w * amount;
             t = t * amount;
             f = f * amount;
             s = s * amount;
          }

          p = parseFloat(p.toFixed(2)); w = parseFloat(w.toFixed(2)); t = parseFloat(t.toFixed(2));
          f = parseFloat(f.toFixed(2)); s = parseFloat(s.toFixed(2));
          // kalorie z makrów — energy.energy bywa w kJ dla niektórych produktów
          const c = Math.round(p * 4 + w * 4 + t * 9);
          totalCals += c; totalProt += p; totalCarbs += w; totalFat += t; totalFiber += f; totalSugar += s;

          const unitMap: any = {
            'gram': 'g', 'milliliter': 'ml', 'portion': 'g/porcja',
            'package': 'opak.', 'cup': 'ml', 'roll': 'szt', 'whole': 'szt',
            'piece': 'szt', 'bottle': 'but.', 'can': 'ml', 'slice': 'plaster',
            'bar': 'szt', 'tablet': 'tabl.', 'scoop': 'miarka',
          };
          const unit = unitMap[item.serving] || item.serving || '';
          const rawAmount = item.amount ?? item.serving_quantity;
          const amountStr = rawAmount != null ? `${rawAmount}${unit ? ' ' + unit : ''}` : unit || '';

          foodEntries.push({
            user_id: userId, date: dateStr, name, calories: c, protein: p, carbs: w, fat: t,
            fiber: f || null, sugar: s || null,
            meal_type: item.daytime || 'snack', amount: amountStr
          });
        }

        if (foodEntries.length === 0) {
          const summary = await yazio.user.getDailySummary({ date: targetDate });
          Object.entries((summary as any).meals || {}).forEach(([mealType, mealData]: [string, any]) => {
            const c = Math.round(mealData.nutrients?.["energy.energy"] || 0);
            const p = parseFloat((mealData.nutrients?.["nutrient.protein"] || 0).toFixed(2));
            const w = parseFloat((mealData.nutrients?.["nutrient.carb"] || 0).toFixed(2));
            const t = parseFloat((mealData.nutrients?.["nutrient.fat"] || 0).toFixed(2));
            if (c > 0 || p > 0) {
              totalCals += c; totalProt += p; totalCarbs += w; totalFat += t;
              foodEntries.push({ user_id: userId, date: dateStr, name: `🍴 Posiłek: ${mealType}`, calories: c, protein: p, carbs: w, fat: t, meal_type: mealType, amount: 'Podsumowanie' });
            }
          });
        }

        let insertedCount = 0;
        let sample: any[] = [];
        if (totalCals > 0 || totalProt > 0) {
          await safeExecute(
            supabase
              .from('daily_nutrition')
              .upsert({ user_id: userId, date: dateStr, calories: totalCals, protein: totalProt, carbs: totalCarbs || null, fat: totalFat || null, fiber: totalFiber || null, sugar: totalSugar || null }, { onConflict: 'user_id,date' })
          );

          await safeExecute(
            supabase
              .from('daily_food_entries')
              .delete()
              .eq('user_id', userId)
              .eq('date', dateStr)
          );

          if (foodEntries.length > 0) {
            await safeExecute(
              supabase
                .from('daily_food_entries')
                .insert(foodEntries)
            );
          }

          const { count, data: insertedSample, error: verifyError } = await supabase
            .from('daily_food_entries')
            .select('name, meal_type, calories, protein', { count: 'exact' })
            .eq('user_id', userId)
            .eq('date', dateStr)
            .limit(3);
          if (verifyError) console.error(`[Yazio] daily_food_entries verify failed:`, verifyError);
          insertedCount = count || 0;
          sample = insertedSample || [];
        }
        results.push({ date: dateStr, items: foodEntries.length, inserted_count: insertedCount, calories: totalCals, sample });
      } catch (err) {
        console.log(`Error ${dateStr}:`, err.message);
        results.push({ date: dateStr, error: err.message });
      }
      if (sync_history) await new Promise(r => setTimeout(r, 50));
    }
    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
})
