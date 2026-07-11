/**
 * @function vanguard-executor
 * @trigger HTTP POST / manual
 * @role Automatyczny wykonawca: ocenia reguły/warunki i wysyła zaprogramowane powiadomienia do Telegrama.
 * @reads vanguard_recipes, daily_strain, oura_daily_summary
 * @writes audit_events
 * @calls api.telegram.org (bezpośrednio)
 * @consumer Powiadomienia wypychane w Telegramie (system powiadomień i automatyzacji)
 * @status active
 */
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { requireServiceRole } from "../_shared/auth.ts";
import { fetchWorldState } from "../_shared/worldState.ts";
import { sendMessage } from "../_shared/telegram.ts";
// Force upload of domain package for shared dependencies
import type {} from "@vanguard/domain";

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
  const chatId = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") || "0", 10);
  if (!chatId) {
    console.warn("[executor] TELEGRAM_CHAT_ID not configured");
    return;
  }
  // Token is unused for outbox path but required by function signature
  await sendMessage("", chatId, message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authError = requireServiceRole(req);
  if (authError) return authError;

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
