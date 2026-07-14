import { deepseekChat } from "../_shared/deepseek.ts";
import { LLM_TASKS } from "../_shared/llm/tasks.ts";

export function isUsableQuestion(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 45) return false;
  if (!t.includes("?")) return false;
  if (/^(opowiedz mi|powiedz mi|jak to|co masz na myśli)\s*,?\s*$/i.test(t)) return false;
  return true;
}

function cleanMemoryLabel(text: string): string {
  return text
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/gi, "")
    .replace(/\s+x\d+\s*:/i, ":")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[:;,\-.]+\s*/, "")
    .replace(/\.\s*\./g, ".")
    .trim()
    .replace(/[.:;,\s]+$/, "");
}

export function buildDeterministicMemoryQuestion(memoryContext: any): string {
  const curiosity = memoryContext.pending_curiosity?.[0];
  if (curiosity?.provocation && curiosity.provocation.includes("?")) return curiosity.provocation;
  if (curiosity?.hypothesis) {
    const hypothesis = cleanMemoryLabel(curiosity.hypothesis);
    const firstClause = hypothesis.split(/[;,]/)[0].trim().slice(0, 80);
    return `Kiedy ostatnio zdarzyło się: ${firstClause}? Co wtedy było inaczej niż zwykle?`;
  }

  const pattern = memoryContext.behavioral_patterns?.[0];
  if (pattern?.title || pattern?.evidence_text) {
    const patternLabel = cleanMemoryLabel(pattern.title || pattern.evidence_text || pattern.pattern_type);
    return `Opowiedz mi więcej o tym wzorcu: ${patternLabel}. Kiedy ostatnio się uruchomił i jaki był pierwszy zauważalny sygnał?`;
  }

  const wiki = memoryContext.wiki_pages?.[0];
  if (wiki?.title) {
    return `Opowiedz mi, co trzeba doprecyzować w temacie "${wiki.title}". Jaki fakt, przykład albo decyzja najlepiej uzupełniłaby pamięć Vanguard?`;
  }

  const edge = memoryContext.graph_edges?.[0];
  if (edge?.source_entity && edge?.target_entity) {
    return `Opowiedz mi więcej o relacji "${edge.source_entity} → ${edge.target_entity}". Co jest tu aktualne, a co może być już stare albo nieprecyzyjne?`;
  }

  const friction = memoryContext.friction_events?.[0];
  if (friction?.friction_type) {
    return `Opowiedz mi więcej o ostatnim tarciu typu "${friction.friction_type}". Jaka była intencja, co faktycznie zrobiłeś i jaki był koszt?`;
  }

  return "Opowiedz mi, które miejsce w pamięci Vanguard najbardziej wymaga doprecyzowania: fakt, relacja, decyzja, wzorzec albo wynik działania.";
}

export async function generateActiveLearningQuestion(
  deepseekApiKey: string,
  userId: string,
  type: "wiki_review" | "stale_link",
  item: any,
): Promise<{ question: string; proposed_memory: any } | null> {
  const systemContent = type === "wiki_review"
    ? `Jesteś systemem aktywnego uczenia w Vanguard OS. Formułujesz krótkie, bezpośrednie pytania po polsku do użytkownika (Jakuba) w celu wyjaśnienia konfliktów lub niepewności w jego bazie wiedzy.
Twoja odpowiedź musi być poprawnym obiektem JSON:
{
  "question": "Jasne pytanie wyjaśniające (max 20 słów), np. Czy na stałe przestałeś pić kawę po 15:00?",
  "proposed_memory": {
    "source": "Jakub",
    "relation": "relacja",
    "target": "wartość",
    "source_type": "user",
    "target_type": "trait"
  }
}
proposed_memory powinno reprezentować fakt, który zostanie zapisany w bazie wiedzy, jeśli Jakub odpowie twierdząco (TAK).`
    : `Jesteś systemem aktywnego uczenia w Vanguard OS. Formułujesz krótkie, bezpośrednie pytania po polsku do użytkownika (Jakuba) w celu weryfikacji starego lub niepewnego faktu z bazy wiedzy.
Twoja odpowiedź musi być poprawnym obiektem JSON:
{
  "question": "Jasne pytanie weryfikacyjne (max 20 słów), np. Czy to prawda, że wciąż studiujesz na AGH?",
  "proposed_memory": {
    "source": "Jakub",
    "relation": "relacja",
    "target": "wartość",
    "source_type": "user",
    "target_type": "trait"
  }
}
proposed_memory powinno reprezentować fakt, który zostanie potwierdzony/zaktualizowany w bazie wiedzy, jeśli Jakub odpowie twierdząco (TAK).`;

  const userContent = type === "wiki_review"
    ? `Kontekst niepewności/konfliktu:\nTyp: ${item.item_type}\nTytuł: ${item.title}\nSzczegóły: ${item.detail}`
    : `Stary/niepewny fakt:\nPodmiot: ${item.source_entity}\nRelacja: ${item.relation}\nObiekt: ${item.target_entity}\nTekst faktu: ${item.fact_text || ""}\nAktualna pewność: ${item.confidence_score}`;

  try {
    const reform = await deepseekChat({
      apiKey: deepseekApiKey,
      ...LLM_TASKS.structured,
      userId,
      feature: "eval-interview-active-learning",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    });

    const parsed = JSON.parse(reform.content || "{}");
    if (parsed.question && parsed.proposed_memory) {
      return { question: parsed.question, proposed_memory: parsed.proposed_memory };
    }
  } catch (e) {
    console.error(`[eval-interview] Failed to format ${type} active learning question:`, e);
  }
  return null;
}

export async function generateDeepeningQuestion(
  deepseekApiKey: string,
  userId: string,
  memoryContext: any,
): Promise<string | null> {
  try {
    const result = await deepseekChat({
      apiKey: deepseekApiKey,
      ...LLM_TASKS.structured,
      responseFormat: undefined,
      userId,
      feature: "eval-interview-deepening",
      maxTokens: 120,
      temperature: 0.5,
      timeoutMs: 15000,
      messages: [
        {
          role: "system",
          content: `Jesteś selektorem pytań dla Vanguard OS.
Masz pamięć użytkownika: pending hypotheses, wzorce, wiki, graf, tarcia, świeży stream i dane biometryczne Oura.
Wybierz JEDNO pytanie o najwyższej wartości informacyjnej dla pamięci systemu.

FORMAT — jeden z tych wzorców:
- "Co konkretnie [obserwacja] — co wtedy robisz?"
- "Kiedy ostatnio [wzorzec], co było inaczej?"
- "Co sprawia że [hipoteza] — jeden przykład?"
- "Jak wygląda [zjawisko] w praktyce?"

Zasady:
- JEDNO zdanie — max 20 słów.
- Musi kończyć się znakiem "?".
- Zero wstępu, zero obserwacji przed pytaniem — tylko samo pytanie.
- Konkretne i operacyjne, nie filozoficzne.
- Zacznij bezpośrednio od pytania (nie od "Opowiedz mi o hipotezie").
- Nie cytuj hipotez ani źródeł — przetłumacz na ludzkie pytanie.
- Nie diagnozuj i nie psychoanalizuj.

ZAKAZY:
- NIE pytaj "dlaczego nie logujesz X" ani "nie odnotowałeś X".
- Jeśli recently_asked_topic_tags zawiera dany temat, wybierz INNY — 7 dni cooldown.
- Unikaj pytań czysto faktograficznych które można sprawdzić w bazie.`,
        },
        {
          role: "user",
          content: `KONTEKST PAMIĘCI:\n${JSON.stringify(memoryContext, null, 2)}\n\nZwróć tylko treść pytania, bez komentarza.`,
        },
      ],
    });
    const candidate = result.content?.trim() || "";
    if (isUsableQuestion(candidate)) return candidate;
  } catch (err: unknown) {
    console.error("[eval-interview] deepening generation failed:", err);
  }
  return null;
}
