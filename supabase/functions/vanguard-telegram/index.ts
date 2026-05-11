import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const AUTHORIZED_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || "0");
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || "";

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

    // --- NOWOŚĆ: GENEROWANIE EMBEDDINGU ---
    let embedding = null;
    try {
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.replace(/\n/g, ' '),
        }),
      });
      const embedData = await embedRes.json();
      embedding = embedData.data?.[0]?.embedding;
    } catch (e) {
      console.error("Embedding Error:", e);
    }

    // Zapis do vanguard_stream
    const { error: streamError } = await supabase
      .from('vanguard_stream')
      .insert({
        user_id: VANGUARD_USER_ID,
        source: 'telegram',
        content: text,
        classification: classification,
        embedding: embedding,
        metadata: { telegram_chat_id: chatId }
      });

    // Jeśli to DECYZJA, zapisz też do vanguard_decisions
    if (classification === 'decision') {
      await supabase
        .from('vanguard_decisions')
        .insert({
          user_id: VANGUARD_USER_ID,
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
