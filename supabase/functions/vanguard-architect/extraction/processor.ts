import { getWarsawDateString } from "../../_shared/time.ts"
import { deepseekChat } from "../../_shared/deepseek.ts"
import { deprecateSupersededLinks } from "../../_shared/deprecateSupersededLinks.ts"
import { getAggregateByDate } from "../../_shared/repos/aggregatesRepo.ts"
import { extractJsonObject, normalizeText } from "./helpers.ts"
import { allowedRelations, deterministicTriads } from "./rules.ts"

export async function processRecords(
  supabase: any,
  records: any[],
  activeLinks: any[],
  userId: string,
  apiKey: string,
  type: string
) {
  let totalTriads = 0
  let failedUpserts = 0
  let failedRecords = 0
  let currentActiveLinks = [...activeLinks]

  for (const record of records) {
    if (!record.content) continue

    const recordDate = getWarsawDateString(new Date(record.created_at))
    let dailyBio = null
    try {
      dailyBio = await getAggregateByDate(supabase, userId, recordDate)
    } catch (dailyBioErr) {
      console.error(`[architect] daily aggregate query error for date ${recordDate}:`, dailyBioErr)
    }
    const activeLinksText = currentActiveLinks
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
  -> {"triads":[{"source":"Jakub","source_type":"person","relation":"planuje","target":"Przejscie z marketingu do sprzedazy bezposredniej","target_type":"goal","memory_type":"fact","confidence_score":0.85,"keywords":"sprzedaz, kariera, zmiana, cel","resolution":{"action":"insert"}}]}`

    try {
      const { content: raw } = await deepseekChat({
        apiKey,
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
      })

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
          const match = currentActiveLinks.find((l: any) =>
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
              currentActiveLinks = currentActiveLinks.filter((l) => l.id !== match.id)
              console.log(`[architect] Mem0 superseded conflicting link: ${match.source_entity} --(${match.relation})--> ${match.target_entity}`)
            }
          }
        } else if (resolutionAction === "merge" && conflictingLink) {
          const match = currentActiveLinks.find((l: any) =>
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
            currentActiveLinks.push({
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

  return {
    totalTriads,
    failedUpserts,
    failedRecords,
  }
}
