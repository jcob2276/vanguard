import { normalizeText } from "./helpers.ts"

export const allowedRelations = [
  "jest", "posiada", "studiuje", "pracuje_w", "mieszka_w", "ma_relacje_z",
  "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzido",
  "spowodowane_przez", "poprzedza", "nastepuje_po", "uzywa", "tworzy",
  "cwiczy", "uczy_sie", "deklaruje", "czuje", "doswiadcza", "wynosi",
  "dotyczy", "zawiera", "wspiera", "blokuje", "planuje", "wymaga",
  "pamieta", "osiaga", "reaguje_na", "wywoluje", "wzmacnia", "oslabia",
  "pracuje_nad", "ma_wspomnienie_z", "wskazuje_na", "ma_wskaznik",
  "ma_egzamin", "analizuje", "uczestniczy_w", "pracowal_w", "studiowal",
  "uczestniczyl_w",
]

type TriadDef = {
  patterns: RegExp[]
  requireAll?: boolean
  triads: Array<{
    source: string; source_type: string; relation: string;
    target: string; target_type: string; memory_type: string; confidence_score: number;
  }>
}

const TRIAD_RULES: TriadDef[] = [
  // Family
  { patterns: [/babci|babcia|babcie/, /krosn/], triads: [
    { source: "Jakub", source_type: "person", relation: "ma_relacje_z", target: "Babcia z Krosna", target_type: "person", memory_type: "fact", confidence_score: 0.95 },
    { source: "Babcia z Krosna", source_type: "person", relation: "mieszka_w", target: "Krosno", target_type: "place", memory_type: "fact", confidence_score: 0.95 },
  ]},
  { patterns: [/babci|babcia|babcie/, /(zeglic|zelic|zeglc|zelc)/], triads: [
    { source: "Jakub", source_type: "person", relation: "ma_relacje_z", target: "Babcia z Zeglic", target_type: "person", memory_type: "fact", confidence_score: 0.9 },
    { source: "Babcia z Zeglic", source_type: "person", relation: "mieszka_w", target: "Zeglice", target_type: "place", memory_type: "fact", confidence_score: 0.9 },
  ]},
  // States
  { patterns: [/ciezko.*gadam|trudno.*gadam|pogadac.*ciezko|z ludzmi.*gadam|ludzmi.*gadam/], triads: [
    { source: "Jakub", source_type: "person", relation: "doswiadcza", target: "Trudnosc rozmow na zywo", target_type: "state", memory_type: "fact", confidence_score: 0.8 },
  ]},
  { patterns: [/cisnienie.*z tylu glowy|z tylu glowy.*cisnienie/], triads: [
    { source: "Rozmowy na zywo", source_type: "event", relation: "wywoluje", target: "Cisnienie z tylu glowy", target_type: "state", memory_type: "fact", confidence_score: 0.8 },
  ]},
  // Work / career
  { patterns: [/z marketingu.*sprzedaz|marketingu.*strony sprzedazy|zejsc z marketingu/], triads: [
    { source: "Jakub", source_type: "person", relation: "planuje", target: "Przejscie z marketingu do sprzedazy", target_type: "goal", memory_type: "fact", confidence_score: 0.85 },
    { source: "Przejscie z marketingu do sprzedazy", source_type: "goal", relation: "wymaga", target: "Zadawanie pytan", target_type: "skill", memory_type: "fact", confidence_score: 0.8 },
  ]},
  { patterns: [/seter telefoniczny|setter telefoniczny|umawiam spotkania przez telefon/], triads: [
    { source: "Jakub", source_type: "person", relation: "jest", target: "Rola setera telefonicznego", target_type: "work_role", memory_type: "fact", confidence_score: 0.9 },
    { source: "Rola setera telefonicznego", source_type: "work_role", relation: "zawiera", target: "Umawianie spotkan przez telefon", target_type: "activity", memory_type: "fact", confidence_score: 0.9 },
  ]},
  { patterns: [/sprzedazy saas|sprzedaz saas|produktow saas|produktow sasowych|sasowych/], triads: [
    { source: "Jakub", source_type: "person", relation: "planuje", target: "Sprzedaz SaaS", target_type: "goal", memory_type: "fact", confidence_score: 0.85 },
  ]},
  { patterns: [/trening sprzedazy|wzmocnic.*sprzedaz|wzmocnic.*pytan|pod kazdym katem wzmocnic/], triads: [
    { source: "Jakub", source_type: "person", relation: "chce", target: "Wzmocnic kompetencje sprzedazowe", target_type: "goal", memory_type: "fact", confidence_score: 0.85 },
  ]},
  { patterns: [/skoncze studia magisterskie|po studiach magisterskich|magisterskie.*kolejny etap/, /sprzedaz na zywo|deale/], requireAll: true, triads: [
    { source: "Jakub", source_type: "person", relation: "planuje", target: "Sprzedaz na zywo po studiach magisterskich", target_type: "goal", memory_type: "fact", confidence_score: 0.75 },
  ]},
  { patterns: [/najlepszej agencji marketingowej|najwieksza.*agencja|najlepsza.*agencja/], triads: [
    { source: "Jakub", source_type: "person", relation: "pracuje_w", target: "Agencja marketingowa i SaaS", target_type: "organization", memory_type: "fact", confidence_score: 0.75 },
  ]},
  // Personal growth
  { patterns: [/rozwoj osobist|samorozwoj|medytow/], triads: [
    { source: "Jakub", source_type: "person", relation: "uczy_sie", target: "Rozwoj osobisty", target_type: "concept", memory_type: "fact", confidence_score: 0.85 },
  ]},
  { patterns: [/agencj.*marketingow|agencje marketingow|salonow spa|reklame na facebooku/], triads: [
    { source: "Jakub", source_type: "person", relation: "tworzy", target: "Agencja marketingowa dla salonow spa", target_type: "project", memory_type: "fact", confidence_score: 0.85 },
    { source: "Agencja marketingowa dla salonow spa", source_type: "project", relation: "uzywa", target: "Reklamy na Facebooku", target_type: "tool", memory_type: "fact", confidence_score: 0.8 },
  ]},
  { patterns: [/tracic ten zapal|tracilem ten zapal|tracil.*zapal/], triads: [
    { source: "Jakub", source_type: "person", relation: "doswiadcza", target: "Utrata zapalu", target_type: "state", memory_type: "fact", confidence_score: 0.75 },
  ]},
  { patterns: [/psychologii na collegium humanum|collegium humanum/], triads: [
    { source: "Jakub", source_type: "person", relation: "studiowal", target: "Psychologia na Collegium Humanum", target_type: "education", memory_type: "fact", confidence_score: 0.8 },
    { source: "Jakub", source_type: "person", relation: "nastepuje_po", target: "Rezygnacja z Collegium Humanum", target_type: "event", memory_type: "fact", confidence_score: 0.8 },
  ]},
  { patterns: [/dostaw.*pizz|pizzerii|alcatras/], triads: [
    { source: "Jakub", source_type: "person", relation: "pracowal_w", target: "Pizzeria Alcatras", target_type: "organization", memory_type: "fact", confidence_score: 0.8 },
  ]},
  { patterns: [/studia.*analiz|na ta analize|na analiz[eę]/], triads: [
    { source: "Jakub", source_type: "person", relation: "studiowal", target: "Analiza Danych", target_type: "education", memory_type: "fact", confidence_score: 0.75 },
  ]},
  { patterns: [/nauce tanca|nauka tanca|tanczylem sam/], triads: [
    { source: "Jakub", source_type: "person", relation: "uczy_sie", target: "Taniec", target_type: "skill", memory_type: "fact", confidence_score: 0.85 },
  ]},
  { patterns: [/toastmasters/], triads: [
    { source: "Jakub", source_type: "person", relation: "uczestniczyl_w", target: "Toastmasters", target_type: "community", memory_type: "fact", confidence_score: 0.9 },
    { source: "Toastmasters", source_type: "community", relation: "wspiera", target: "Poznawanie ludzi", target_type: "activity", memory_type: "fact", confidence_score: 0.85 },
  ]},
  { patterns: [/spotkania.*buduja zycie|wyjscia z domu daja wiecej|siedzenie.*samotnosci/], triads: [
    { source: "Jakub", source_type: "person", relation: "deklaruje", target: "Spotkania buduja zycie i polaczenia", target_type: "belief", memory_type: "fact", confidence_score: 0.9 },
  ]},
  { patterns: [/gawronsk|gavronify|gawronie/], triads: [
    { source: "Jakub", source_type: "person", relation: "pracuje_w", target: "Gavronify", target_type: "organization", memory_type: "fact", confidence_score: 0.9 },
  ]},
  { patterns: [/wolno rozwijam sie jako sprzedawca|wolno rozwijam sie.*setter|duza luka/], triads: [
    { source: "Jakub", source_type: "person", relation: "doswiadcza", target: "Wolny rozwoj w sprzedazy", target_type: "state", memory_type: "fact", confidence_score: 0.85 },
  ]},
]

const COUSIN_NAMES: Array<[string, RegExp]> = [
  ["Wiolka", /wiolk/],
  ["Kinga", /king/],
  ["Malgosia", /malgosi|malgosia|malgo|gosia/],
]

export function deterministicTriads(text: string) {
  const n = normalizeText(text || "")
  const triads: any[] = []

  for (const rule of TRIAD_RULES) {
    const matched = rule.requireAll
      ? rule.patterns.every(p => p.test(n))
      : rule.patterns.some(p => p.test(n));
    if (matched) triads.push(...rule.triads);
  }

  if (/kuzynk/.test(n)) {
    for (const [name, pattern] of COUSIN_NAMES) {
      if (pattern.test(n)) {
        triads.push({
          source: "Jakub", source_type: "person", relation: "ma_relacje_z",
          target: `Kuzynka ${name}`, target_type: "person", memory_type: "fact", confidence_score: 0.85,
        })
      }
    }
  }

  return triads
}
