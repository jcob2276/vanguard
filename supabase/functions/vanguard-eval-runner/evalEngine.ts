import { openaiChat } from "../_shared/openai.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

export interface Assertion {
  type: 'contains' | 'not_contains' | 'regex' | 'contains_all' | 'contains_any' | 'length_min' | 'length_max' | 'llm' | 'llm_judge';
  value?: any;
}

async function judgeAnswer(params: {
  question: string;
  expected_answer: string;
  expected_claims: string[];
  actual_answer: string;
}): Promise<{ score: number; passed: boolean; notes: string }> {
  const { question, expected_answer, expected_claims, actual_answer } = params;
  const claimsList = (expected_claims || []).map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `Jesteś sędzią oceniającym jakość odpowiedzi systemu AI (Vanguard Oracle).

PYTANIE: ${question}

OCZEKIWANA ODPOWIEDŹ (wzorzec):
${expected_answer}

OCZEKIWANE TWIERDZENIA (każde musi być obecne):
${claimsList || '(brak)'}

FAKTYCZNA ODPOWIEDŹ SYSTEMU:
${actual_answer}

Oceń faktyczną odpowiedź w skali 0.0–1.0:
- 1.0 = zawiera wszystkie oczekiwane twierdzenia, jest spójna z wzorcem
- 0.7–0.9 = zawiera większość twierdzeń, drobne braki
- 0.4–0.6 = częściowo poprawna, brakuje kluczowych informacji
- 0.0–0.3 = zła odpowiedź, halucynacje

Odpowiedz TYLKO w JSON:
{"score": 0.0, "passed": false, "notes": "uzasadnienie po polsku (max 2 zdania)"}

PRÓG ZALICZENIA: score >= 0.7`;

  try {
    const { content } = await openaiChat({
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      responseFormat: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      timeoutMs: 15000,
    });
    const parsed = JSON.parse(content);
    return { score: Number(parsed.score ?? 0), passed: Boolean(parsed.passed ?? false), notes: String(parsed.notes ?? '') };
  } catch (err: any) {
    return { score: 0, passed: false, notes: `Judge API error: ${String(err?.message || err).substring(0, 100)}` };
  }
}

export async function evaluateQuestion(
  q: { question: string; expected_answer?: string; expected_claims?: string[]; metadata?: { assertions?: Assertion[]; run_llm_judge?: boolean; llm_judge?: boolean } },
  actualAnswer: string
): Promise<{ score: number; passed: boolean; notes: string }> {
  const assertions: Assertion[] = [];
  if (q.metadata && typeof q.metadata === 'object') {
    if (Array.isArray(q.metadata.assertions)) assertions.push(...q.metadata.assertions);
    if (q.metadata.run_llm_judge === true || q.metadata.llm_judge === true) assertions.push({ type: 'llm_judge' });
  }

  if (assertions.length === 0) {
    return await judgeAnswer({ question: q.question, expected_answer: q.expected_answer || '', expected_claims: q.expected_claims || [], actual_answer: actualAnswer });
  }

  let passedCount = 0;
  const failedNotes: string[] = [];

  for (const assertion of assertions) {
    const { type, value } = assertion;
    let assertionPassed = true;
    let assertionNote = '';

    switch (type) {
      case 'contains': {
        const valStr = String(value);
        assertionPassed = actualAnswer.includes(valStr);
        if (!assertionPassed) assertionNote = `Expected to contain "${valStr}"`;
        break;
      }
      case 'not_contains': {
        const valStr = String(value);
        assertionPassed = !actualAnswer.includes(valStr);
        if (!assertionPassed) assertionNote = `Expected NOT to contain "${valStr}"`;
        break;
      }
      case 'regex': {
        try { assertionPassed = new RegExp(String(value)).test(actualAnswer); if (!assertionPassed) assertionNote = `Expected to match regex /${value}/`; }
        catch (err: any) { assertionPassed = false; assertionNote = `Invalid regex: ${value} (${err.message})`; }
        break;
      }
      case 'contains_all': {
        if (!Array.isArray(value)) { assertionPassed = false; assertionNote = 'contains_all must be array'; }
        else { const missing = value.filter(v => !actualAnswer.includes(String(v))); assertionPassed = missing.length === 0; if (!assertionPassed) assertionNote = `Missing: ${missing.map(m => `"${m}"`).join(', ')}`; }
        break;
      }
      case 'contains_any': {
        if (!Array.isArray(value)) { assertionPassed = false; assertionNote = 'contains_any must be array'; }
        else { assertionPassed = value.some(v => actualAnswer.includes(String(v))); if (!assertionPassed) assertionNote = `Expected one of: ${value.map(m => `"${m}"`).join(', ')}`; }
        break;
      }
      case 'length_min': { assertionPassed = actualAnswer.length >= Number(value); if (!assertionPassed) assertionNote = `Min length ${value}, got ${actualAnswer.length}`; break; }
      case 'length_max': { assertionPassed = actualAnswer.length <= Number(value); if (!assertionPassed) assertionNote = `Max length ${value}, got ${actualAnswer.length}`; break; }
      case 'llm':
      case 'llm_judge': {
        const judgment = await judgeAnswer({ question: q.question, expected_answer: String(value || q.expected_answer || ''), expected_claims: q.expected_claims || [], actual_answer: actualAnswer });
        assertionPassed = judgment.passed;
        if (!assertionPassed) assertionNote = `LLM Judge failed: ${judgment.notes}`;
        break;
      }
      default: { assertionPassed = false; assertionNote = `Unknown type: "${type}"`; }
    }

    if (assertionPassed) passedCount++;
    else failedNotes.push(assertionNote);
  }

  const score = passedCount / assertions.length;
  const passed = passedCount === assertions.length;
  const notes = passed ? "All assertions passed." : `Failed: ${failedNotes.join("; ")}`;
  return { score, passed, notes };
}
