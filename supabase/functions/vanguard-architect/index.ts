import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { getVanguardUserId } from "../_shared/constants.ts"
import { getWarsawDateString } from "../_shared/time.ts"
import { deepseekChat } from "../_shared/deepseek.ts"


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

// ---------------------------------------------------------------------------
// Auto-deprecation helper (Zmiana 4)
// Calls the SQL function that supersedes conflicting active facts when a new
// high-confidence (>= 0.80) fact arrives for the same (source, relation).
// Returns the number of records deprecated (for logging).
// ---------------------------------------------------------------------------
async function deprecateSupersededLinks(
  supabase: ReturnType<typeof import("../_shared/supabase.ts").createServiceClient>,
  userId: string,
  source: string,
  relation: string,
  newTarget: string,
  newConfidence: number,
  newEpisodeId: string | null,
): Promise<number> {
  if (newConfidence < 0.80) return 0
  if (!source || !relation || !newTarget) return 0

  try {
    const { data, error } = await supabase.rpc("deprecate_superseded_facts", {
      p_user_id:        userId,
      p_source:         source,
      p_relation:       relation,
      p_new_target:     newTarget,
      p_new_confidence: newConfidence,
      p_new_episode_id: newEpisodeId ?? null,
    })
    if (error) {
      console.error("[architect] deprecateSupersededLinks error:", error)
      return 0
    }
    return typeof data === "number" ? data : 0
  } catch (err) {
    console.error("[architect] deprecateSupersededLinks exception:", err)
    return 0
  }
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

    const { data: activeLinksRaw, error: activeLinksErr } = await supabase
      .from("vanguard_entity_links")
      .select("id, source_entity, relation, target_entity, weight, confidence_score, metadata, evidence_count")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(150)

    if (activeLinksErr) {
      console.error("[architect] Failed to fetch active links:", activeLinksErr)
    }
    const activeLinks: any[] = activeLinksRaw || []

    for (const record of records) {
      if (!record.content) continue

      const recordDate = getWarsawDateString(new Date(record.created_at))
      const { data: dailyBio, error: dailyBioErr } = await supabase
        .from("vanguard_daily_aggregates")
        .select("hrv_avg, sleep_hours, final_state, execution_score, dopamine_load_index")
        .eq("user_id", userId)
        .eq("date", recordDate)
        .maybeSingle()
      if (dailyBioErr) {
        console.error(`[architect] daily aggregate query error for date ${recordDate}:`, dailyBioErr)
      }
      const activeLinksText = activeLinks
        .map((l: any) => `- (${l.source_entity}) --(${l.relation})--> (${l.target_entity}) [confidence: ${l.confidence_score}]`)
        .join("\n")

      const systemPrompt = `Jestes rygorystycznym Architektem Grafu Vanguard OS. Z tekstu i biometrii wyciagnij triady relacji.

ZASADY EKSTRAKCJI (Graphiti + LightRAG patterns):
- Encja = konkretna, nazwana rzecz. ZAWSZE uzywaj NAJSPECYFICZNIEJSZEJ formy: "Cyberbezpieczenstwo magisterskie URz" nie "studia", "trening biegu 10km" nie "sport".
- Uzywaj "Jakub" jako kanonicznej encji uzytkownika. Nigdy: "ja", "uzytkownik", "on".
- Encje piszemy z Wielkiej Litery (Title Case): "Babcia z Krosna", "Gavronify", "Sprzedaz SaaS".
- NIE twórz wezlów z: pospolitych rzeczowników (dzien, zycie, ludzie, rzeczy, czas), dat, przyslowkow, emocji bez konkretnego targetu.
- Deduplication (Graphiti rule): jesli dwie encje sa TYM SAMYM obiektem realnym, uzywaj pelniejszej nazwy. "NYC" = "New York City" → "New York City".
- NIGDY nie fabrykuj encji spoza tekstu.
- Jesli wniosek nie jest wprost powiedzany → memory_type="hypothesis", confidence_score <= 0.65.
- Relacja MUSI byc jedna z listy:
${allowedRelations.join(", ")}
- Dla rodziny: ma_relacje_z, zna_osobe, mieszka_w, pamieta, wywoluje.
- Dla miejsc: konkretny wezel miejsca np. "Krosno", "Zeglice", "Rzeszow".
- Dla osob rodzinnych: opisowe wezly np. "Babcia z Krosna", "Kuzynka Wiolka".

DYSKUSJA I ROZWIĄZYWANIE KONFLIKTÓW PAMIĘCI (Mem0 pattern):
Porównaj każdą nowo wyciąganą triadę z aktualną listą istniejących faktów w grafie:
EXISTING ACTIVE FACTS:
${activeLinksText || "(brak)"}

Dla każdej nowej triady określ jej "resolution":
- "action": "insert" -> Nowy fakt, który nie dotyczy ani nie koliduje z żadnym istniejącym faktem.
- "action": "merge" -> Nowa triada opisuje ten sam fakt, który już istnieje (identyczny subject, relation i target, np. ponowne wspomnienie tego samego faktu). Wskazuje to na duplikację/wzmocnienie. W "conflicting_link" podaj istniejący fakt.
- "action": "supersede" -> Nowa triada bezpośrednio zaprzecza lub nadpisuje istniejący fakt (np. zmiana miejsca zamieszkania, nowa rola zawodowa zastępująca starą, zmiana nawyku). Stary fakt zostanie oznaczony jako historyczny/przestarzały. W "conflicting_link" podaj istniejący fakt, który jest nadpisywany.

POLE KEYWORDS (LightRAG pattern):
Dla kazdej triady dodaj "keywords" — 2-4 slowa kluczowe tematyczne oddzielone przecinkiem.

Format odpowiedzi, TYLKO JSON:
{
  "triads": [
    {
      "source": "Jakub",
      "source_type": "person",
      "relation": "jest",
      "target": "Student",
      "target_type": "concept",
      "memory_type": "fact",
      "confidence_score": 0.9,
      "keywords": "studia, edukacja",
      "resolution": {
        "action": "supersede",
        "conflicting_link": {
          "source": "Jakub",
          "relation": "jest",
          "target": "Inzynier"
        }
      }
    }
  ]
}

Przyklady:
- Tekst: "mam dwie babcie, jedna mieszka w Krosnie, druga w Zeglicach"
  -> {"triads":[
    {"source":"Jakub","source_type":"person","relation":"ma_relacje_z","target":"Babcia z Krosna","target_type":"person","memory_type":"fact","confidence_score":0.9,"keywords":"rodzina, babcia, relacje","resolution":{"action":"insert"}},
    {"source":"Babcia z Krosna","source_type":"person","relation":"mieszka_w","target":"Krosno","target_type":"place","memory_type":"fact","confidence_score":0.9,"keywords":"miejsce, Krosno, babcia","resolution":{"action":"insert"}},
    {"source":"Jakub","source_type":"person","relation":"ma_relacje_z","target":"Babcia z Zeglic","target_type":"person","memory_type":"fact","confidence_score":0.9,"keywords":"rodzina, babcia, relacje","resolution":{"action":"insert"}},
    {"source":"Babcia z Zeglic","source_type":"person","relation":"mieszka_w","target":"Zeglice","target_type":"place","memory_type":"fact","confidence_score":0.9,"keywords":"miejsce, Zeglice, babcia","resolution":{"action":"insert"}}
  ]}
- Tekst: "chce przejsc ze sfera marketingowej do sprzedazy na zywo"
  -> {"triads":[{"source":"Jakub","source_type":"person","relation":"planuje","target":"Przejscie z marketingu do sprzedazy bezposredniej","target_type":"goal","memory_type":"fact","confidence_score":0.85,"keywords":"sprzedaz, kariera, zmiana, cel","resolution":{"action":"insert"}}]}`;

      try {
        const { content: raw } = await deepseekChat({
          apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
          model: "deepseek-v4-flash",
          temperature: 0.1,
          maxTokens: 2200,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `[BIOMETRIA_Z_DNIA]: ${JSON.stringify(dailyBio || null)}\n[TEKST]: ${record.content.slice(0, 6000)}`,
            },
          ],
        });

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

        let totalDeprecated = 0
        for (const triad of triads) {
          if (!triad.source || !triad.relation || !triad.target) continue
          if (!allowedRelations.includes(triad.relation)) {
            failedUpserts++
            console.error(`Architect rejected relation outside ontology: ${triad.relation}`)
            continue
          }

          const resolutionAction = triad.resolution?.action || "insert"
          const conflictingLink = triad.resolution?.conflicting_link

          let existingToMerge: any = null

          if (resolutionAction === "supersede" && conflictingLink) {
            const match = activeLinks.find((l: any) =>
              normalizeText(l.source_entity) === normalizeText(conflictingLink.source) &&
              l.relation === conflictingLink.relation &&
              normalizeText(l.target_entity) === normalizeText(conflictingLink.target)
            )
            if (match) {
              const { error: depErr } = await supabase
                .from("vanguard_entity_links")
                .update({
                  status: "deprecated",
                  temporal_status: "historical",
                  valid_until: new Date().toISOString(),
                  metadata: {
                    ...(match.metadata || {}),
                    deprecated_reason: "mem0_llm_superseded",
                    superseded_by_episode: record.id,
                  }
                })
                .eq("id", match.id)

              if (depErr) {
                console.error(`[architect] Failed to deprecate link ${match.id}:`, depErr)
              } else {
                totalDeprecated++
                match.status = "deprecated"
                match.temporal_status = "historical"
                console.log(`[architect] Mem0 superseded conflicting link: ${match.source_entity} --(${match.relation})--> ${match.target_entity}`)
              }
            }
          } else if (resolutionAction === "merge" && conflictingLink) {
            const match = activeLinks.find((l: any) =>
              normalizeText(l.source_entity) === normalizeText(conflictingLink.source) &&
              l.relation === conflictingLink.relation &&
              normalizeText(l.target_entity) === normalizeText(conflictingLink.target)
            )
            if (match) {
              existingToMerge = match
            }
          }

          if (existingToMerge) {
            const newWeight = Math.max(existingToMerge.weight || 1.0, triad.confidence_score || 0.7)
            const newCount = (existingToMerge.evidence_count || 1) + 1
            const { error: updateErr } = await supabase
              .from("vanguard_entity_links")
              .update({
                weight: newWeight,
                evidence_count: newCount,
                last_seen: getWarsawDateString()
              })
              .eq("id", existingToMerge.id)

            if (updateErr) {
              console.error(`[architect] Failed to merge link ${existingToMerge.id}:`, updateErr)
              failedUpserts++
            } else {
              totalTriads++
              existingToMerge.weight = newWeight
              existingToMerge.evidence_count = newCount
              console.log(`[architect] Mem0 merged link: ${existingToMerge.source_entity} --(${existingToMerge.relation})--> ${existingToMerge.target_entity}`)
            }
          } else {
            // Otherwise insert/upsert
            if (resolutionAction === "insert" || !conflictingLink) {
              const deprecated = await deprecateSupersededLinks(
                supabase,
                userId,
                triad.source,
                triad.relation,
                triad.target,
                triad.confidence_score || 0.7,
                record.id,
              )
              if (deprecated > 0) {
                totalDeprecated += deprecated
                console.log(`[architect] Fallback deprecated ${deprecated} link(s) for ${triad.source} --(${triad.relation})--> *`)
              }
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
              p_metadata: {
                source: "vanguard_architect",
                input_type: type,
                ...(triad.keywords ? { keywords: triad.keywords } : {}),
              },
              p_observed_at: record.created_at,
              p_source_episode_id: record.id,
            })

            if (upsertError) {
              failedUpserts++
              console.error("Architect graph upsert error:", upsertError)
            } else {
              totalTriads++
              activeLinks.push({
                source_entity: triad.source,
                relation: triad.relation,
                target_entity: triad.target,
                weight: triad.confidence_score || 0.7,
                confidence_score: triad.confidence_score || 0.7,
                metadata: { source: "vanguard_architect" },
                evidence_count: 1
              })
            }
          }
        }
        if (totalDeprecated > 0) {
          console.log(`[architect] record ${record.id}: ${totalTriads} upserted, ${totalDeprecated} deprecated`)
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
