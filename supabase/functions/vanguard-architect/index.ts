import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { getVanguardUserId } from "../_shared/constants.ts"

const allowedRelations = [
  "jest", "posiada", "studiuje", "pracuje_w", "mieszka_w", "ma_relacje_z",
  "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzi_do",
  "spowodowane_przez", "poprzedza", "nastepuje_po", "uzywa", "tworzy",
  "cwiczy", "uczy_sie", "deklaruje", "czuje", "doswiadcza", "wynosi",
  "dotyczy", "zawiera", "wspiera", "blokuje", "planuje", "wymaga",
  "pamieta", "osiaga", "reaguje_na", "wywoluje", "wzmacnia", "oslabia",
  "pracuje_nad", "ma_wspomnienie_z", "wskazuje_na", "ma_wskaznik",
  "ma_egzamin", "analizuje", "uczestniczy_w", "pracowal_w", "studiowal",
  "uczestniczyl_w",
]

function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : cleaned)
}

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function deterministicTriads(text: string) {
  const raw = text || ""
  const n = normalizeText(raw)
  const triads: any[] = []

  if (/babci|babcia|babcie/.test(n) && /krosn/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "ma_relacje_z",
        target: "Babcia z Krosna",
        target_type: "person",
        memory_type: "fact",
        confidence_score: 0.95,
      },
      {
        source: "Babcia z Krosna",
        source_type: "person",
        relation: "mieszka_w",
        target: "Krosno",
        target_type: "place",
        memory_type: "fact",
        confidence_score: 0.95,
      },
    )
  }

  if (/babci|babcia|babcie/.test(n) && /(zeglic|zelic|zeglc|zelc)/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "ma_relacje_z",
        target: "Babcia z Zeglic",
        target_type: "person",
        memory_type: "fact",
        confidence_score: 0.9,
      },
      {
        source: "Babcia z Zeglic",
        source_type: "person",
        relation: "mieszka_w",
        target: "Zeglice",
        target_type: "place",
        memory_type: "fact",
        confidence_score: 0.9,
      },
    )
  }

  const cousinNames = [
    ["Wiolka", /wiolk/],
    ["Kinga", /king/],
    ["Malgosia", /malgosi|malgosia|malgo|gosia/],
  ]

  if (/kuzynk/.test(n)) {
    for (const [name, pattern] of cousinNames) {
      if ((pattern as RegExp).test(n)) {
        triads.push({
          source: "Jakub",
          source_type: "person",
          relation: "ma_relacje_z",
          target: `Kuzynka ${name}`,
          target_type: "person",
          memory_type: "fact",
          confidence_score: 0.85,
        })
      }
    }
  }

  if (/ciezko.*gadam|trudno.*gadam|pogadac.*ciezko|z ludzmi.*gadam|ludzmi.*gadam/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "doswiadcza",
      target: "Trudnosc rozmow na zywo",
      target_type: "state",
      memory_type: "fact",
      confidence_score: 0.8,
    })
  }

  if (/cisnienie.*z tylu glowy|z tylu glowy.*cisnienie/.test(n)) {
    triads.push({
      source: "Rozmowy na zywo",
      source_type: "event",
      relation: "wywoluje",
      target: "Cisnienie z tylu glowy",
      target_type: "state",
      memory_type: "fact",
      confidence_score: 0.8,
    })
  }

  if (/z marketingu.*sprzedaz|marketingu.*strony sprzedazy|zejsc z marketingu/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "planuje",
        target: "Przejscie z marketingu do sprzedazy",
        target_type: "goal",
        memory_type: "fact",
        confidence_score: 0.85,
      },
      {
        source: "Przejscie z marketingu do sprzedazy",
        source_type: "goal",
        relation: "wymaga",
        target: "Zadawanie pytan",
        target_type: "skill",
        memory_type: "fact",
        confidence_score: 0.8,
      },
    )
  }

  if (/seter telefoniczny|setter telefoniczny|umawiam spotkania przez telefon/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "jest",
        target: "Rola setera telefonicznego",
        target_type: "work_role",
        memory_type: "fact",
        confidence_score: 0.9,
      },
      {
        source: "Rola setera telefonicznego",
        source_type: "work_role",
        relation: "zawiera",
        target: "Umawianie spotkan przez telefon",
        target_type: "activity",
        memory_type: "fact",
        confidence_score: 0.9,
      },
    )
  }

  if (/sprzedazy saas|sprzedaz saas|produktow saas|produktow sasowych|sasowych/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "planuje",
      target: "Sprzedaz SaaS",
      target_type: "goal",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  if (/trening sprzedazy|wzmocnic.*sprzedaz|wzmocnic.*pytan|pod kazdym katem wzmocnic/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "chce",
      target: "Wzmocnic kompetencje sprzedazowe",
      target_type: "goal",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  if (/skoncze studia magisterskie|po studiach magisterskich|magisterskie.*kolejny etap/.test(n) && /sprzedaz na zywo|deale/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "planuje",
      target: "Sprzedaz na zywo po studiach magisterskich",
      target_type: "goal",
      memory_type: "fact",
      confidence_score: 0.75,
    })
  }

  if (/najlepszej agencji marketingowej|najwieksza.*agencja|najlepsza.*agencja/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "pracuje_w",
      target: "Agencja marketingowa i SaaS",
      target_type: "organization",
      memory_type: "fact",
      confidence_score: 0.75,
    })
  }

  if (/rozwoj osobist|samorozwoj|medytow/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "uczy_sie",
      target: "Rozwoj osobisty",
      target_type: "concept",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  if (/agencj.*marketingow|agencje marketingow|salonow spa|reklame na facebooku/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "tworzy",
        target: "Agencja marketingowa dla salonow spa",
        target_type: "project",
        memory_type: "fact",
        confidence_score: 0.85,
      },
      {
        source: "Agencja marketingowa dla salonow spa",
        source_type: "project",
        relation: "uzywa",
        target: "Reklamy na Facebooku",
        target_type: "tool",
        memory_type: "fact",
        confidence_score: 0.8,
      },
    )
  }

  if (/tracic ten zapal|tracilem ten zapal|tracil.*zapal/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "doswiadcza",
      target: "Utrata zapalu",
      target_type: "state",
      memory_type: "fact",
      confidence_score: 0.75,
    })
  }

  if (/psychologii na collegium humanum|collegium humanum/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "studiowal",
        target: "Psychologia na Collegium Humanum",
        target_type: "education",
        memory_type: "fact",
        confidence_score: 0.8,
      },
      {
        source: "Jakub",
        source_type: "person",
        relation: "nastepuje_po",
        target: "Rezygnacja z Collegium Humanum",
        target_type: "event",
        memory_type: "fact",
        confidence_score: 0.8,
      },
    )
  }

  if (/dostaw.*pizz|pizzerii|alcatras/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "pracowal_w",
      target: "Pizzeria Alcatras",
      target_type: "organization",
      memory_type: "fact",
      confidence_score: 0.8,
    })
  }

  if (/studia.*analiz|na ta analize|na analiz[eę]/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "studiowal",
      target: "Analiza Danych",
      target_type: "education",
      memory_type: "fact",
      confidence_score: 0.75,
    })
  }

  if (/nauce tanca|nauka tanca|tanczylem sam/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "uczy_sie",
      target: "Taniec",
      target_type: "skill",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  if (/toastmasters/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "uczestniczyl_w",
        target: "Toastmasters",
        target_type: "community",
        memory_type: "fact",
        confidence_score: 0.9,
      },
      {
        source: "Toastmasters",
        source_type: "community",
        relation: "wspiera",
        target: "Poznawanie ludzi",
        target_type: "activity",
        memory_type: "fact",
        confidence_score: 0.85,
      },
    )
  }

  if (/spotkania.*buduja zycie|wyjscia z domu daja wiecej|siedzenie.*samotnosci/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "deklaruje",
      target: "Spotkania buduja zycie i polaczenia",
      target_type: "belief",
      memory_type: "fact",
      confidence_score: 0.9,
    })
  }

  if (/gawronsk|gavronify|gawronie/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "pracuje_w",
      target: "Gavronify",
      target_type: "organization",
      memory_type: "fact",
      confidence_score: 0.9,
    })
  }

  if (/wolno rozwijam sie jako sprzedawca|wolno rozwijam sie.*setter|duza luka/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "doswiadcza",
      target: "Luka kompetencyjna w sprzedazy",
      target_type: "state",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  if (/maraton/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "osiaga",
      target: "Dwa maratony",
      target_type: "event",
      memory_type: "fact",
      confidence_score: 0.8,
    })
  }

  if (/jul.*tomon|julki tomon/.test(n) && /maraton/.test(n)) {
    triads.push({
      source: "Zakochanie w Julce Tomon",
      source_type: "event",
      relation: "wywoluje",
      target: "Pierwszy maraton",
      target_type: "event",
      memory_type: "hypothesis",
      confidence_score: 0.65,
    })
  }

  if (/dawida kozluka|kozluka/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "uzywa",
      target: "Program Dawida Kozluka",
      target_type: "program",
      memory_type: "fact",
      confidence_score: 0.9,
    })
  }

  if (/13% tkanki tluszczowej|13 procent tkanki tluszczowej|obecnie.*20%/.test(n)) {
    triads.push(
      {
        source: "Jakub",
        source_type: "person",
        relation: "dazy_do",
        target: "13 procent tkanki tluszczowej",
        target_type: "goal",
        memory_type: "fact",
        confidence_score: 0.9,
      },
      {
        source: "Jakub",
        source_type: "person",
        relation: "ma_wskaznik",
        target: "Około 20 procent tkanki tluszczowej",
        target_type: "physical_state",
        memory_type: "fact",
        confidence_score: 0.75,
      },
    )
  }

  if (/drugiego trenera od biegania|trenera od biegania/.test(n)) {
    triads.push({
      source: "Jakub",
      source_type: "person",
      relation: "planuje",
      target: "Trener biegania od 1 czerwca",
      target_type: "goal",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  return triads
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabase = createServiceClient()

    const { type = "knowledge", offset = 0, limit = 5, record_id = null } = await req.json()
    const userId = getVanguardUserId()
    const table = type === "knowledge" ? "vanguard_knowledge" : "vanguard_stream"

    console.log(`Architect starting: type=${type} offset=${offset} limit=${limit} record_id=${record_id || "none"}`)

    let query = supabase
      .from(table)
      .select("id, content, created_at")
      .eq("user_id", userId)

    if (record_id) {
      query = query.eq("id", record_id).limit(1)
    } else {
      query = query
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)
    }

    const { data: records, error: fetchError } = await query

    if (fetchError) throw fetchError
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "No more records", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let totalTriads = 0
    let failedUpserts = 0
    let failedRecords = 0

    for (const record of records) {
      if (!record.content) continue

      const recordDate = new Date(record.created_at).toISOString().split("T")[0]
      const { data: dailyBio, error: dailyBioErr } = await supabase
        .from("vanguard_daily_aggregates")
        .select("hrv_avg, sleep_hours, final_state, execution_score, dopamine_load_index")
        .eq("user_id", userId)
        .eq("date", recordDate)
        .maybeSingle()
      if (dailyBioErr) {
        console.error(`[architect] daily aggregate query error for date ${recordDate}:`, dailyBioErr)
      }

      const systemPrompt = `Jestes rygorystycznym Architektem Grafu Vanguard OS. Z tekstu i biometrii wyciagnij triady relacji.

Zasady:
- Uzywaj "Jakub" jako kanonicznej encji uzytkownika.
- Tylko konkretne encje nazwane, zlozone koncepty i konkretne stany biologiczne.
- Nie tworz wezlow z pospolitych rzeczownikow, dat ani przyslowkow.
- Jesli wniosek nie jest powiedziany wprost, ustaw memory_type="hypothesis".
- Relacja MUSI byc jedna z listy:
${allowedRelations.join(", ")}
- Jesli tekst zawiera osoby, miejsca albo relacje rodzinne, NIE zwracaj pustej listy.
- Dla rodziny uzywaj relacji: ma_relacje_z, zna_osobe, mieszka_w, pamieta, wywoluje.
- Dla miejsc uzywaj konkretnego wezla miejsca, np. "Krosno", "Zeglice", "Rzeszow".
- Dla osob rodzinnych tworz konkretne wezly opisowe, np. "Babcia z Krosna", "Babcia z Zeglic", "Kuzynka Wiolka".

Format odpowiedzi, tylko JSON:
{"triads":[{"source":"Jakub","source_type":"person","relation":"czuje","target":"Stres","target_type":"concept","memory_type":"fact","confidence_score":0.8}]}

Przyklady:
- Tekst: "mam dwie babcie, jedna mieszka w Krosnie, druga w Zeglicach"
  -> {"triads":[
    {"source":"Jakub","source_type":"person","relation":"ma_relacje_z","target":"Babcia z Krosna","target_type":"person","memory_type":"fact","confidence_score":0.9},
    {"source":"Babcia z Krosna","source_type":"person","relation":"mieszka_w","target":"Krosno","target_type":"place","memory_type":"fact","confidence_score":0.9},
    {"source":"Jakub","source_type":"person","relation":"ma_relacje_z","target":"Babcia z Zeglic","target_type":"person","memory_type":"fact","confidence_score":0.9},
    {"source":"Babcia z Zeglic","source_type":"person","relation":"mieszka_w","target":"Zeglice","target_type":"place","memory_type":"fact","confidence_score":0.9}
  ]}
- Tekst: "moja kuzynka Wiolka"
  -> {"triads":[{"source":"Jakub","source_type":"person","relation":"ma_relacje_z","target":"Kuzynka Wiolka","target_type":"person","memory_type":"fact","confidence_score":0.85}]}`;

      try {
        const llmRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("DEEPSEEK_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-v4-flash",
            temperature: 0.1,
            max_tokens: 2200,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `[BIOMETRIA_Z_DNIA]: ${JSON.stringify(dailyBio || null)}\n[TEKST]: ${record.content.slice(0, 6000)}`,
              },
            ],
          }),
        })

        if (!llmRes.ok) {
          console.error(`Architect LLM error ${llmRes.status}: ${await llmRes.text()}`)
          failedRecords++
          continue
        }

        const llmData = await llmRes.json()
        const raw = llmData.choices?.[0]?.message?.content || "{}"
        const parsed = extractJsonObject(raw)
        const llmTriads = Array.isArray(parsed.triads) ? parsed.triads : []
        const fallbackTriads = deterministicTriads(record.content)
        const triads = [...llmTriads, ...fallbackTriads].filter((triad, index, all) =>
          index === all.findIndex((other) =>
            other.source === triad.source &&
            other.relation === triad.relation &&
            other.target === triad.target
          )
        )

        for (const triad of triads) {
          if (!triad.source || !triad.relation || !triad.target) continue
          if (!allowedRelations.includes(triad.relation)) {
            failedUpserts++
            console.error(`Architect rejected relation outside ontology: ${triad.relation}`)
            continue
          }

          const { error: upsertError } = await supabase.rpc("upsert_vanguard_entity_link", {
            p_user_id: userId,
            p_source: triad.source,
            p_source_type: triad.source_type || "concept",
            p_relation: triad.relation,
            p_target: triad.target,
            p_target_type: triad.target_type || "concept",
            p_confidence_score: triad.confidence_score || 0.7,
            p_memory_type: triad.memory_type || "fact",
            p_layer: "intelligence",
            p_metadata: { source: "vanguard_architect", input_type: type },
            p_observed_at: record.created_at,
            p_source_episode_id: record.id,
          })

          if (upsertError) {
            failedUpserts++
            console.error("Architect graph upsert error:", upsertError)
          } else {
            totalTriads++
          }
        }
      } catch (error) {
        console.error("Error processing record in Architect:", error)
        failedRecords++
      }
    }

    return new Response(JSON.stringify({
      message: "Batch processed",
      items_processed: records.length,
      triads_created: totalTriads,
      failed_upserts: failedUpserts,
      failed_records: failedRecords,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    console.error("Architect fatal error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
