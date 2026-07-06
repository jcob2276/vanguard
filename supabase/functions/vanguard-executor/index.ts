import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { fetchWorldState } from "../_shared/worldState.ts";

// Simple safe evaluator for recipes
function evaluateCondition(condition: string, state: any): boolean {
  try {
    const fn = new Function('state', `
      with (state) {
        return ${condition};
      }
    `);
    return !!fn(state);
  } catch (e) {
    console.error(`[executor] Error evaluating condition "${condition}":`, e);
    return false;
  }
}

async function notifyTelegram(message: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    console.warn("[executor] Telegram credentials not configured");
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    console.log("[executor] Starting recipe execution cycle");

    const { data: recipes, error } = await supabase
      .from('vanguard_recipes')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group recipes by user
    const userRecipes = recipes.reduce((acc: any, r: any) => {
      acc[r.user_id] = acc[r.user_id] || [];
      acc[r.user_id].push(r);
      return acc;
    }, {});

    let processed = 0;

    for (const userId of Object.keys(userRecipes)) {
      console.log(`[executor] Fetching WorldState for user ${userId}`);
      const worldState = await fetchWorldState(supabase, userId);
      
      for (const recipe of userRecipes[userId]) {
        console.log(`[executor] Evaluating recipe ${recipe.id} (${recipe.name})`);
        
        let shouldTrigger = true;
        if (recipe.trigger_condition) {
          shouldTrigger = evaluateCondition(recipe.trigger_condition, worldState);
        }

        if (shouldTrigger) {
          console.log(`[executor] Triggering action for recipe ${recipe.id}`);
          if (recipe.action_type === 'notify_telegram') {
             const message = recipe.action_payload?.message || `Recipe ${recipe.name} triggered!`;
             await notifyTelegram(message);
          } else {
             console.log(`[executor] Unknown action type: ${recipe.action_type}`);
          }
        }
        processed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("[executor] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
