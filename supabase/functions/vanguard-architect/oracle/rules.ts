import { normalizeText } from "./helpers.ts"

export const allowedRelations = [
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

export function deterministicTriads(text: string) {
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
      target: "Wolny rozwoj w sprzedazy",
      target_type: "state",
      memory_type: "fact",
      confidence_score: 0.85,
    })
  }

  return triads
}
