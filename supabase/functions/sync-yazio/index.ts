import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as YazioLib from "https://esm.sh/yazio"
const { Yazio } = YazioLib

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { userId, sync_history, days } = await req.json().catch(() => ({ userId: null, sync_history: false, days: null }))
    if (!userId) throw new Error('Missing userId')

    const { data: settings } = await supabase.from('user_settings').select('yazio_username, yazio_password').eq('user_id', userId).single()
    if (!settings?.yazio_username) throw new Error('Missing credentials')

    const yazio = new Yazio({ credentials: { username: settings.yazio_username, password: settings.yazio_password } })
    await yazio.user.get(); 
    const yazioToken = (yazio as any)._token || (yazio as any).credentials?.password;

    const daysToSync = days || (sync_history ? 30 : 1)
    const results = []
    const productCache: Record<string, string> = {};

    for (let i = 0; i < daysToSync; i++) {
      const targetDate = new Date()
      if (sync_history) targetDate.setDate(targetDate.getDate() - i)
      const dateStr = targetDate.toISOString().split('T')[0]

      try {
        let foodEntries: any[] = [];
        let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;

        console.log(`[Yazio] Syncing ${dateStr}...`);
        const consumed: any = await yazio.user.getConsumedItems({ date: targetDate });
        const items = [...(consumed.products || []), ...(consumed.recipe_portions || []), ...(consumed.simple_products || [])];

        for (const item of items) {
          let name = item.name || item.product?.name || item.recipe?.name || item.food?.name || item.title;
          let nutrients = item.nutrients || {};

          // FIX: Manual fetch if product details are missing
          if ((!name || !nutrients["energy.energy"]) && item.product_id) {
            const cacheKey = `p_${item.product_id}`;
            if (productCache[cacheKey]) {
              const cachedData = JSON.parse(productCache[cacheKey]);
              name = cachedData.name; nutrients = cachedData.nutrients;
            } else {
              try {
                console.log(`[Yazio] Manual fetch for product: ${item.product_id}`);
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
          const amount = parseFloat(item.amount) || 0;
          let c = Math.round(nutrients["energy.energy"] || 0);
          let p = nutrients["nutrient.protein"] || 0;
          let w = nutrients["nutrient.carb"] || 0;
          let t = nutrients["nutrient.fat"] || 0;

          // If nutrients are per 1g/ml (standard in Yazio API for products), just multiply by amount
          if (item.product_id && amount > 0 && !nutrients._scaled) {
             c = Math.round(c * amount);
             p = p * amount;
             w = w * amount;
             t = t * amount;
          }
          
          p = parseFloat(p.toFixed(2)); w = parseFloat(w.toFixed(2)); t = parseFloat(t.toFixed(2));
          totalCals += c; totalProt += p; totalCarbs += w; totalFat += t;

          // Human-friendly amount string
          const unitMap: any = {
            'gram': 'g', 'milliliter': 'ml', 'portion': 'g/porcja', 
            'package': 'opak.', 'cup': 'szt/opak', 'roll': 'szt',
            'whole': 'szt/całość', 'piece': 'szt', 'bottle': 'but.'
          };
          const unit = unitMap[item.serving] || item.serving || '';
          const amountStr = `${item.amount}${unit ? ' ' + unit : ''}`;

          foodEntries.push({
            user_id: userId, date: dateStr, name, calories: c, protein: p, carbs: w, fat: t,
            meal_type: item.meal_type || 'snack', amount: amountStr
          });
        }

        // Fallback for empty days
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

        if (foodEntries.length > 0) {
          await supabase.from('daily_nutrition').upsert({ user_id: userId, date: dateStr, calories: totalCals, protein: totalProt }, { onConflict: 'user_id,date' });
          
          // Używamy UPSERT zamiast DELETE+INSERT dla zachowania integralności
          const { error: foodError } = await supabase.from('daily_food_entries').upsert(foodEntries, { 
            onConflict: 'user_id,date,name,meal_type' 
          });
          
          if (foodError) console.error(`[Yazio] Upsert error for ${dateStr}:`, foodError.message);
        }
        results.push({ date: dateStr, items: foodEntries.length });
      } catch (err) { console.log(`Error ${dateStr}:`, err.message); }
      if (sync_history) await new Promise(r => setTimeout(r, 50));
    }
    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
})
