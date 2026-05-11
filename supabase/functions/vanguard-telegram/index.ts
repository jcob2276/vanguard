import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = "7504183176:AAFAfdQ7oMsjpnjZCz2dCZy-FmnxZVn1pA0";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const AUTHORIZED_CHAT_ID = 2031950649;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.message || payload.edited_message;
    if (!message || !message.text) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const text = message.text;

    // Zabezpieczenie: Reaguj tylko na wiadomości od Jakuba
    if (chatId !== AUTHORIZED_CHAT_ID) {
      return new Response("Unauthorized", { status: 200 });
    }

    // --- NOWOŚĆ: AUTO-KLASYFIKACJA ---
    let classification = 'thought';
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('decyzja') || lowerText.includes('postanawiam') || lowerText.includes('wybieram')) {
      classification = 'decision';
    } else if (lowerText.includes('pomysł') || lowerText.includes('idea')) {
      classification = 'idea';
    } else if (lowerText.includes('chaos') || lowerText.includes('stres') || lowerText.includes('trudne')) {
      classification = 'chaos';
    } else if (lowerText.includes('insight') || lowerText.includes('refleksja')) {
      classification = 'insight';
    }

    // Zapis do vanguard_stream
    const { error: streamError } = await supabase
      .from('vanguard_stream')
      .insert({
        user_id: "165ae341-670c-46ce-82dc-434c4dbfcdfd",
        source: 'telegram',
        content: text,
        classification: classification,
        metadata: { telegram_chat_id: chatId }
      });

    // Jeśli to DECYZJA, zapisz też do vanguard_decisions
    if (classification === 'decision') {
      await supabase
        .from('vanguard_decisions')
        .insert({
          user_id: "165ae341-670c-46ce-82dc-434c4dbfcdfd",
          decision_text: text,
          emotional_state: 'logged_via_telegram'
        });
    }

    if (streamError) throw streamError;

    // Odpowiedź do bota
    const icons = { 'decision': '⚖️', 'idea': '💡', 'chaos': '🌀', 'insight': '🧠', 'thought': '💭' };
    const responseText = `${icons[classification]} Zapisano jako: *${classification.toUpperCase()}*`;
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
        parse_mode: "Markdown"
      })
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(err.message, { status: 500 });
  }
});
