import { encodeBase64 } from "https://deno.land/std@0.223.0/encoding/base64.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";

export async function handlePhotoLabel(
  photoArray: any[],
  chatId: number,
  telegramToken: string,
  openAiKey: string,
  vanguardUserId: string,
  supabase: any,
): Promise<void> {
  try {
    if (!photoArray || photoArray.length === 0) {
      await safeSendTelegram(chatId, "❌ Nie otrzymałem zdjęcia.", telegramToken);
      return;
    }

    await safeSendTelegram(chatId, "📸 Analizuję etykietę ze zdjęcia...", telegramToken, { disable_notification: true });

    // Pick the largest image size
    const largestPhoto = photoArray[photoArray.length - 1];
    const fileId = largestPhoto.file_id;

    // Get file path from Telegram
    const getFileRes = await fetch(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`);
    if (!getFileRes.ok) {
      throw new Error(`Telegram getFile failed: HTTP ${getFileRes.status}`);
    }
    const getFileData = await getFileRes.json();
    const filePath = getFileData.result?.file_path;
    if (!filePath) {
      throw new Error("Telegram returned no file_path");
    }

    // Download file
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${telegramToken}/${filePath}`);
    if (!downloadRes.ok) {
      throw new Error(`Telegram file download failed: HTTP ${downloadRes.status}`);
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    const base64Image = encodeBase64(new Uint8Array(arrayBuffer));

    // Send to OpenAI Vision API
    const systemPrompt = `Jesteś precyzyjnym systemem OCR do etykiet wartości odżywczych (tabele składników na opakowaniach produktów).
Twoim zadaniem jest odczytanie z obrazu wartości odżywczych na 100g (lub 100ml) produktu oraz sugerowanej nazwy i marki.

Wymagane wartości na 100g (nie na porcję!):
- calories (kcal)
- protein (g)
- carbs (g)
- fat (g)
- fiber (g) (jeśli podano, inaczej null)
- sugar (g) (jeśli podano, inaczej null)
- brand (marka/producent, np. "Piątnica")
- name (nazwa produktu, np. "Serek Wiejski Lekki")

Zwróć poprawny JSON (wyłącznie JSON, bez markdownu):
{
  "name": "Sugerowana nazwa",
  "brand": "Marka lub null",
  "calories": 120,
  "protein": 11.0,
  "carbs": 2.0,
  "fat": 3.0,
  "fiber": null,
  "sugar": 1.5
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Vision failed: HTTP ${res.status} - ${errText}`);
    }

    const oaiData = await res.json();
    const content = oaiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty message content");
    }

    const macro = JSON.parse(content) as {
      name?: string;
      brand?: string | null;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number | null;
      sugar?: number | null;
    };

    if (!macro.name || macro.calories == null) {
      await safeSendTelegram(chatId, "⚠️ Nie byłem w stanie odczytać tabeli wartości odżywczych na 100g z tego zdjęcia. Upewnij się, że tabela jest wyraźna.", telegramToken);
      return;
    }

    const brandName = macro.brand || "[OCR Etykieta]";
    
    // Upsert into food_library
    const { error: upsertErr } = await supabase.from("food_library").upsert({
      user_id: vanguardUserId,
      name: macro.name,
      brand: brandName,
      calories: Math.round(macro.calories),
      protein: Number(macro.protein || 0),
      carbs: Number(macro.carbs || 0),
      fat: Number(macro.fat || 0),
      fiber: macro.fiber ? Number(macro.fiber) : null,
      sugar: macro.sugar ? Number(macro.sugar) : null,
      default_grams: 100,
      source: "manual"
    }, { onConflict: "user_id,name,brand" });

    if (upsertErr) throw upsertErr;

    const confirmationMsg = `✅ *Zapisano produkt z etykiety!*\n\n` +
      `• *Nazwa:* ${macro.name}\n` +
      `• *Marka:* ${brandName}\n` +
      `• *Kalorie:* ${Math.round(macro.calories)} kcal/100g\n` +
      `• *B:* ${macro.protein}g | *W:* ${macro.carbs}g | *T:* ${macro.fat}g\n` +
      `${macro.fiber ? `• *Błonnik:* ${macro.fiber}g\n` : ""}` +
      `${macro.sugar ? `• *Cukier:* ${macro.sugar}g\n` : ""}\n` +
      `Produkt został dodany do Twojej \`food_library\`. Możesz go teraz logować podając jego nazwę!`;

    await safeSendTelegram(chatId, confirmationMsg, telegramToken, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("[photoLabel] Exception:", err);
    await safeSendTelegram(chatId, `❌ Wystąpił błąd podczas analizy zdjęcia: ${err.message}`, telegramToken);
  }
}
