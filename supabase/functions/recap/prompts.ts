const PILLAR_LABEL: Record<string, string> = { cialo: "Ciało", duch: "Duch", konto: "Konto" };

export function factsToPrompt(f: any): string {
  const pillarLines = Object.entries(f.pillarTally as Record<string, { done: number; total: number }>)
    .map(([k, v]) => `- ${PILLAR_LABEL[k]}: ${v.done}/${v.total} dni zrobione`)
    .join("\n") || "(brak)";

  const readinessLine = f.readiness.length
    ? f.readiness.map((r: any) => `${r.date}=${r.score}`).join(", ")
    : "brak danych";

  const doneBlock = f.doneTasks.length
    ? f.doneTasks.map((t: any) => `${t.status === "done" ? "✓" : "↯"} ${t.title}${t.section ? ` [${t.section}]` : ""}`).join("\n")
    : "(brak)";

  const voiceBlock = f.thisWeekVoice.length
    ? f.thisWeekVoice.map((v: any) => {
        const d = new Date(v.timestamp).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short" });
        const src = v.source === "identity_vault" ? "głosówka" : v.source === "eval_interview" ? "wywiad AI" : "telegram-voice";
        return `--- ${d} [${src}${v.classification ? `·${v.classification}` : ""}] ---\n${String(v.content).slice(0, 600)}`;
      }).join("\n\n")
    : "(brak głosówek w tym tygodniu)";

  const shortMsgs = f.thisWeekShortMsgs.length
    ? "\n\nKRÓTKIE WIADOMOŚCI TELEGRAM:\n" + f.thisWeekShortMsgs.map((s: any) => {
        const d = new Date(s.timestamp).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric" });
        return `${d}: ${s.content}`;
      }).join("\n")
    : "";

  const projectsBlock = f.activeProjects.length
    ? f.activeProjects.map((p: any) => `- ${p.name}${p.goal ? ` (cel: ${p.goal})` : ""}`).join("\n")
    : "(brak)";

  const kpisBlock = f.kpiValuesList.length
    ? f.kpiValuesList.map((k: any) => {
        const valStr = k.value !== null ? String(k.value) : "niezalogowane";
        const tgtStr = k.target !== null ? ` / cel: ${k.target}` : "";
        const unitStr = k.unit ? ` ${k.unit}` : "";
        const projStr = k.projectName ? ` [Projekt: ${k.projectName}]` : "";
        return `- ${k.name}: ${valStr}${tgtStr}${unitStr}${projStr}`;
      }).join("\n")
    : "(brak)";

  const reconBlock = f.reconciliationList.length
    ? f.reconciliationList.map((r: any) => {
        const parts = [`- Samopoczucie/Ocena: ${r.score != null ? `${r.score}/10` : "brak oceny"} [Tryb: ${r.mode ?? "brak"}]`];
        if (r.morningAction) parts.push(`  Intencja poranna: ${r.morningAction}`);
        if (r.middayStatus || r.middayBlocker) parts.push(`  Midday Check-in: Status=${r.middayStatus ?? "brak"}${r.middayBlocker ? `, Blocker=${r.middayBlocker}` : ""}`);
        if (r.summary) { const textSummary = typeof r.summary === "object" ? JSON.stringify(r.summary) : String(r.summary); parts.push(`  Podsumowanie wieczorne AI: ${textSummary}`); }
        if (r.userResponse) parts.push(`  Tekst wieczorny Jakuba (raw): ${r.userResponse}`);
        return `--- ${r.date} ---\n${parts.join("\n")}`;
      }).join("\n\n")
    : "(brak)";

  const patternsBlock = f.behavioralPatterns?.length
    ? f.behavioralPatterns.map((p: any) => `- [${p.status}] ${p.title || p.pattern_type}: ${p.evidence_text} (confidence: ${p.confidence}, occurrence_count: ${p.occurrence_count})`).join("\n")
    : "(brak)";

  const curiosityBlock = f.curiosityQueue?.length
    ? f.curiosityQueue.map((c: any) => `- [${c.category}] ${c.hypothesis} (${c.provocation ? `provocation: ${c.provocation}` : ""})`).join("\n")
    : "(brak)";

  const claimsBlock = f.claims?.length
    ? f.claims.map((c: any) => `- [${c.epistemic_status}][${c.status}] ${c.fact_text} (${new Date(c.learned_at).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })})`).join("\n")
    : "(brak)";

  return `Tydzień: ${f.weekStart} – ${f.weekEnd}

${f.monthTheme ? `TEMAT MIESIĄCA (horyzont 4 tyg.): ${f.monthTheme}\n` : ""}${f.sprintGoal ? `CEL SPRINTU (12 tyg.): ${f.sprintGoal}\n` : ""}
POWERLIST per dzień:
${f.dayLines.join("\n") || "(brak)"}

POWERLIST per filar:
${pillarLines}

SEN: śr. ${f.sleepHrs != null ? f.sleepHrs.toFixed(1) + "h" : "brak"}, śr. zaśnięcie ${f.bedtime ?? "brak"}
READINESS (Oura): ${readinessLine}

JEDZENIE: śr. ${f.avgKcal != null ? Math.round(f.avgKcal) + " kcal" : "brak"}${f.targetKcal ? ` (cel ${f.targetKcal})` : ""}, białko śr. ${f.avgProtein != null ? Math.round(f.avgProtein) + "g" : "brak"}, dni z logiem: ${f.nutritionDays}

TRENING (Strava): ${f.runCount} aktywności, ${f.totalKm.toFixed(1)}km${f.runs.length ? " — " + f.runs.map((r: any) => `${r.name || r.type}: ${r.km}km`).join(", ") : ""}

NAWYK(I) — wystąpienia:
${f.habitLines.join("\n") || "(brak)"}

TASKI ZAMKNIĘTE / ODRZUCONE W TYM TYGODNIU:
${doneBlock}

ZALEGŁE HIGH PRIORITY (bez ruchu):
${f.staleHighLines.join("\n") || "(brak)"}

AKTYWNE PROJEKTY:
${projectsBlock}

KPI PROJEKTÓW / CELÓW (zalogowane wartości tygodniowe):
${kpisBlock}

WZORCE BEHAWIORALNE W BAZIE (Etap 1):
${patternsBlock}

AKTYWNE HIPOTEZY / PYTANIA ANALITYKA (Curiosity Queue):
${curiosityBlock}

ZMIANY W BAZIE WIEDZY / W MODELU SIEBIE (Claims z tego tygodnia):
${claimsBlock}

PODSUMOWANIA DZIENNE (Tryb dnia + Refleksja wieczorna):
${reconBlock}

POCKET: ${f.unreadLinksCount} niezaczytanych linków

GŁOSÓWKI I NOTATKI JAKUBA (jego autentyczny głos — to jest główne źródło):
${voiceBlock}${shortMsgs}`;
}
