import { corsHeaders, createServiceClient, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const SYSTEM = `Jestes asystentem organizacji zadan dla Jakuba (23 lata, Rzeszow, Polska).
Dostajesz JEDNO zadanie i zwracasz klasyfikacje w JSON.

Zasady bucket:
- "today"  = cos pilnego lub na dzis
- "soon"   = do zrobienia w ciagu 1-7 dni
- "later"  = za 1-4 tygodnie, brak jasnosci co do czasu
- "future" = konkretna data za >1 miesiac (np. "we wrzesniu", "w grudniu")

Zasady due_date:
- Wyciagnij date z tekstu jesli mozliwe (format YYYY-MM-DD, Warsaw TZ)
- "we wrzesniu" -> ustaw na ok. 5 dni PRZED (np. 2026-08-26 jako przypomnienie)
- Jesli brak daty -> null

Zasady priority (tylko gdy uzytkownik NIE podal priorytetu):
- "urgent" = blokuje cos innego lub jest deadline dzisiaj
- "high"   = wazne, trzeba zrobic w tym tygodniu
- "normal" = standardowe
- "low"    = kiedys, nice to have

Odpowiedz WYLACZNIE poprawnym JSON z polami: ai_bucket, due_date, priority.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { itemId, userId: requestedUserId, title, notes, due_date, priority } = body;
    const { userId } = await resolveUserScope(req, requestedUserId ?? null);

    if (!itemId || !userId || !title) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
    const todayFull = new Date().toLocaleDateString("pl-PL", {
      timeZone: "Europe/Warsaw",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });

    const userMsg = [
      `Zadanie: "${title}"`,
      notes ? `Opis: "${notes}"` : null,
      due_date ? `Uzytkownik juz wpisal date: ${due_date} - NIE nadpisuj.` : null,
      priority ? `Uzytkownik juz wpisal priorytet: ${priority} - NIE nadpisuj.` : null,
      `Dzisiaj: ${todayFull} (${todayIso})`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      maxTokens: 120,
      temperature: 0,
      responseFormat: { type: "json_object" },
    });

    const classification = parseJsonFromContent(result.content) || {};
    const ai_bucket = (classification.ai_bucket as string) || "later";

    const supabase = createServiceClient();

    const patch: Record<string, unknown> = {
      ai_bucket,
      ai_classified_at: new Date().toISOString(),
    };
    if (!due_date && classification.due_date) patch.due_date = classification.due_date;
    if (!priority && classification.priority) patch.priority = classification.priority;

    await supabase
      .from("todo_items")
      .update(patch)
      .eq("id", itemId)
      .eq("user_id", userId);

    return new Response(JSON.stringify({ ok: true, ...patch }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[todo-classify]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
