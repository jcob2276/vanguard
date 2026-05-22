import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOJO_TOKEN = Deno.env.get("DOJO_TELEGRAM_BOT_TOKEN") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DOJO_USER_ID = Deno.env.get("VANGUARD_USER_ID") || "";
const AUTHORIZED_CHAT_ID = parseInt(Deno.env.get("DOJO_TELEGRAM_CHAT_ID") || "0");

const SKILL_SLUG = "persuasive_communication_mode_v1_jakub_adapted";
const EVAL_MODEL = "deepseek-chat";
const EVAL_PROMPT_VERSION = "setter_v1";

const POLISH_FILLERS = ["yyyy", "yyy", "yy", "eee", "ee", "ehe", "jakby", "jakby", "tutaj", "no ", "no,", "właśnie", "znaczy", "wiesz", "rozumiesz", "tak więc", "i tak"];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- Telegram helpers ----

async function sendMessage(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${DOJO_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

// ---- Audio helpers ----

async function transcribeAudio(fileId: string): Promise<{ transcript: string; durationSeconds: number }> {
  const fileRes = await fetch(`https://api.telegram.org/bot${DOJO_TOKEN}/getFile?file_id=${fileId}`);
  if (!fileRes.ok) throw new Error(`Telegram getFile error: ${fileRes.status}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error("getFile returned not ok");

  const filePath = fileData.result.file_path;
  const audioRes = await fetch(`https://api.telegram.org/file/bot${DOJO_TOKEN}/${filePath}`);
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append("file", audioBlob, "voice.ogg");
  form.append("model", "whisper-1");
  form.append("language", "pl");
  form.append("response_format", "verbose_json");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!whisperRes.ok) {
    const errText = await whisperRes.text().catch(() => "");
    throw new Error(`Whisper error (${whisperRes.status}): ${errText.slice(0, 200)}`);
  }

  const data = await whisperRes.json();
  if (data.error) throw new Error(`Whisper error: ${data.error.message}`);

  const transcript: string = data.text || "";
  const durationSeconds: number = data.duration || 0;
  return { transcript, durationSeconds };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateFillerDensity(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const filler of POLISH_FILLERS) {
    let pos = 0;
    while ((pos = lower.indexOf(filler, pos)) !== -1) {
      count++;
      pos += filler.length;
    }
  }
  const words = countWords(text);
  return words > 0 ? count / words : 0;
}

function estimateSentenceLengthAvg(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((sum, s) => sum + countWords(s), 0);
  return total / sentences.length;
}

// ---- DB helpers ----

async function getActiveRun(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("dojo_runs")
    .select("*")
    .eq("user_id", DOJO_USER_ID)
    .not("phase", "eq", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveRun error:", error.message);
    return null;
  }
  return data;
}

async function getCurriculumDay(day: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("dojo_curricula")
    .select("days, metadata")
    .eq("slug", SKILL_SLUG)
    .single();
  if (error || !data) {
    console.error("getCurriculumDay error:", error?.message);
    return null;
  }
  const dayData = (data.days as Record<string, unknown>[]).find((d) => d.day === day);
  return dayData || null;
}

async function saveRep(params: {
  runId: string;
  day: number;
  phase: string;
  repType: string;
  transcript: string;
  audioDuration: number;
  wordCount: number;
  evalResult: Record<string, unknown> | null;
  status: string;
  parentRepId: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("dojo_reps")
    .insert({
      run_id: params.runId,
      user_id: DOJO_USER_ID,
      day: params.day,
      phase: params.phase,
      rep_type: params.repType,
      transcript: params.transcript,
      audio_duration_seconds: params.audioDuration,
      word_count: params.wordCount,
      evaluation_result: params.evalResult,
      status: params.status,
      parent_rep_id: params.parentRepId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`saveRep error: ${error.message}`);
  return (data as { id: string }).id;
}

async function updateRun(runId: string, updates: Record<string, unknown>): Promise<void> {
  const nextUpdates = { ...updates };
  if (typeof updates.phase === "string") {
    nextUpdates.current_rep = updates.phase;
  }

  const { error } = await supabase
    .from("dojo_runs")
    .update({ ...nextUpdates, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(`updateRun error: ${error.message}`);
}

// ---- Evaluation LLM ----

interface EvalResult {
  worked: string;
  improve: string;
  nextRep: string;
  status: "pass" | "partial" | "repeat_day";
  rawContent: string;
}

async function evaluateRep(
  dayData: Record<string, unknown>,
  transcript: string,
  audioDuration: number,
  wordCount: number,
  baselineStats: Record<string, unknown> | null
): Promise<EvalResult> {
  const constraint = dayData.primary_constraint as string;

  // Day 0 diagnostic: auto-pass, no evaluation
  if (dayData.day === 0 || constraint === "Brak") {
    return { worked: "Próbka diagnostyczna zebrana.", improve: "-", nextRep: "-", status: "pass", rawContent: "" };
  }

  // Day 30 final: auto-pass, comparison only
  if (dayData.day === 30) {
    return { worked: "Próbka końcowa zebrana.", improve: "-", nextRep: "-", status: "pass", rawContent: "" };
  }

  const baselineStr = baselineStats
    ? `- Słowa na sekundę: ${(baselineStats.words_per_second as number)?.toFixed(2) ?? "brak"}
- Gęstość fillerów: ${baselineStats.filler_density_estimate ?? "brak"}
- Śr. długość zdania: ${baselineStats.sentence_length_avg ?? "brak"} słów`
    : "Brak danych z Day 0 (baseline).";

  const wordsPerSec = audioDuration > 0 ? (wordCount / audioDuration).toFixed(2) : "?";

  const prompt = `Jesteś evaluatorem behawioralnym dla systemu treningu komunikacji.

Dzień: ${dayData.day}
Fokus: ${dayData.focus}
Primary constraint (oceniaj TYLKO to): ${constraint}
Adapter: ${dayData.adapter}

Transkrypt:
${transcript}

Audio: ${audioDuration.toFixed(1)}s | Słowa: ${wordCount} | Tempo: ${wordsPerSec} słów/s

Baseline (Dzień 0):
${baselineStr}

ZASADY:
- Oceniaj WYŁĄCZNIE primary constraint powyżej. Nic innego.
- Porównaj z baseline tam gdzie ma sens.
- Jeden bullet na sekcję. Konkretnie.
- Status "pass" = constraint w pełni spełniony
- Status "partial" = w większości spełniony, drobny błąd
- Status "repeat_day" = constraint wyraźnie złamany

Odpowiedz DOKŁADNIE w tym formacie (bez żadnego innego tekstu):
Worked:
- [jedna rzecz]
Improve:
- [jedna rzecz]
Next rep:
- [jedna instrukcja]
Status: pass`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EVAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DeepSeek eval error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";

  const statusMatch = content.match(/Status:\s*(pass|partial|repeat_day)/i);
  const workedMatch = content.match(/Worked:\s*\n-\s*(.+)/i);
  const improveMatch = content.match(/Improve:\s*\n-\s*(.+)/i);
  const nextRepMatch = content.match(/Next rep:\s*\n-\s*(.+)/i);

  return {
    worked: workedMatch?.[1]?.trim() || "-",
    improve: improveMatch?.[1]?.trim() || "-",
    nextRep: nextRepMatch?.[1]?.trim() || "-",
    status: (statusMatch?.[1]?.toLowerCase() as "pass" | "partial" | "repeat_day") || "partial",
    rawContent: content,
  };
}

// ---- State machine ----

function shouldTriggerCorrection(
  evalStatus: string,
  dayData: Record<string, unknown>
): boolean {
  if (evalStatus !== "repeat_day") return false;
  const corrRep = dayData.correction_rep_a as Record<string, unknown> | undefined;
  if (!corrRep) return false;
  const trigger = corrRep.trigger as string;
  return trigger !== "none" && trigger !== "Brak" && Boolean(trigger);
}

interface StateTransition {
  nextPhase: string;
  nextDay: number;
  pendingCorrectionId: string | null;
}

function computeNextState(
  run: Record<string, unknown>,
  evalStatus: string,
  repId: string,
  dayData: Record<string, unknown>
): StateTransition {
  const phase = run.phase as string;
  const currentDay = run.current_day as number;
  let nextPhase = phase;
  let nextDay = currentDay;
  let pendingCorrectionId = (run.pending_correction_parent_rep_id as string) || null;

  if (phase === "rep_a") {
    if (shouldTriggerCorrection(evalStatus, dayData)) {
      nextPhase = "correction_rep_a";
      pendingCorrectionId = repId;
    } else {
      nextPhase = "rep_b";
    }
  } else if (phase === "correction_rep_a") {
    // Always advance after correction — even on repeat_day, user has tried twice
    nextPhase = "rep_b";
    pendingCorrectionId = null;
  } else if (phase === "rep_b") {
    if (evalStatus === "repeat_day") {
      nextPhase = "rep_b";
    } else {
      nextPhase = "real_life_transfer";
    }
  } else if (phase === "real_life_transfer") {
    const newDay = currentDay + 1;
    if (newDay > 30) {
      nextPhase = "completed";
      nextDay = 30;
    } else {
      nextDay = newDay;
      nextPhase = "rep_a";
    }
    pendingCorrectionId = null;
  }

  return { nextPhase, nextDay, pendingCorrectionId };
}

// ---- Message builders ----

function buildEvalMessage(eval_: EvalResult, dayData: Record<string, unknown>): string {
  if (dayData.day === 0 || dayData.day === 30) return "";
  return `*Worked:*\n- ${eval_.worked}\n\n*Improve:*\n- ${eval_.improve}\n\n*Next rep:*\n- ${eval_.nextRep}\n\n*Status:* ${eval_.status}`;
}

function buildNextInstruction(
  nextPhase: string,
  nextDay: number,
  currentDay: number,
  dayData: Record<string, unknown>,
  nextDayData: Record<string, unknown> | null
): string {
  if (nextPhase === "correction_rep_a") {
    const corrRep = dayData.correction_rep_a as Record<string, unknown>;
    return `⚡ *Correction Rep:*\n${corrRep.instruction_template}\n\nNagraj voice note (${corrRep.duration_seconds}s)`;
  }

  if (nextPhase === "rep_b") {
    const repB = dayData.rep_b as Record<string, unknown>;
    return `🎯 *Rep B — Dzień ${currentDay}:*\n${repB.instruction}\n\nNagraj voice note (${repB.duration_seconds}s)`;
  }

  if (nextPhase === "real_life_transfer") {
    const transfer = dayData.real_life_transfer as Record<string, unknown>;
    return `🌍 *Real-Life Transfer — Dzień ${currentDay}:*\n${transfer.instruction}\n\n✅ Gdy zrobisz: wyślij "done"`;
  }

  if (nextPhase === "rep_a" && nextDay > currentDay && nextDayData) {
    const repA = nextDayData.rep_a as Record<string, unknown>;
    return `✅ *Dzień ${currentDay} ukończony!*\n\n📅 *Jutro — Dzień ${nextDay}: ${nextDayData.focus}*\n🎯 Constraint: ${nextDayData.primary_constraint}\n\n*Rep A:*\n${repA.instruction}\n\nNagraj voice note (${repA.duration_seconds}s) gdy będziesz gotowy.`;
  }

  if (nextPhase === "completed") {
    return `🏆 *30-dniowy sprint ukończony!*\n\nDzień 0 → Dzień 30 porównanie gotowe. Sprawdź baseline_stats w bazie.\n\nNa podstawie porównania wybierz następny sprint.`;
  }

  return "";
}

// ---- Baseline stats (Day 0) ----

function computeBaselineStats(
  repATranscript: string,
  repADuration: number,
  repBTranscript: string,
  repBDuration: number
): Record<string, unknown> {
  const allText = repATranscript + " " + repBTranscript;
  const totalDuration = repADuration + repBDuration;
  const totalWords = countWords(allText);

  return {
    words_per_second: totalDuration > 0 ? totalWords / totalDuration : 0,
    filler_density_estimate: estimateFillerDensity(allText),
    sentence_length_avg: estimateSentenceLengthAvg(allText),
    avg_question_length_words: (() => {
      const questions = allText.split("?").filter((q) => q.trim().length > 0);
      if (questions.length === 0) return 0;
      const total = questions.reduce((sum, q) => sum + countWords(q), 0);
      return total / questions.length;
    })(),
    audio_duration_seconds: totalDuration,
    total_word_count: totalWords,
    evaluation_model: EVAL_MODEL,
    evaluation_prompt_version: EVAL_PROMPT_VERSION,
    computed_at: new Date().toISOString(),
  };
}

// ---- Handlers ----

async function handleStart(chatId: number): Promise<Response> {
  // Check if active run exists
  const existing = await getActiveRun();
  if (existing) {
    return handleStatus(chatId);
  }

  // Create new run
  const { data: run, error } = await supabase
    .from("dojo_runs")
    .insert({
      user_id: DOJO_USER_ID,
      skill_name: SKILL_SLUG,
      current_day: 0,
      phase: "rep_a",
      attempts_on_day: 0,
    })
    .select("id")
    .single();

  if (error || !run) {
    await sendMessage(chatId, "Błąd tworzenia runu. Sprawdź logi.");
    return new Response("error");
  }

  const day0 = await getCurriculumDay(0);
  if (!day0) {
    await sendMessage(chatId, "Curriculum nie znalezione. Uruchom najpierw import_curriculum.ts.");
    return new Response("error");
  }

  const repA = day0.rep_a as Record<string, unknown>;
  const microRep1 = day0.micro_rep_1 as Record<string, unknown>;
  const microRep2 = day0.micro_rep_2 as Record<string, unknown>;
  const repB = day0.rep_b as Record<string, unknown>;

  await sendMessage(
    chatId,
    `🥋 *Practice Dojo — Start*\n\n*Skill:* Persuasive Communication Mode V1\n\n📊 *Dzień 0 — Diagnostyka Bazowa*\n_Bez oceniania. Zbieramy próbki do baseline._\n\n` +
    `*Rep A (${repA.duration_seconds}s):*\n${repA.instruction}\n\n` +
    `*Ćwicz solo (nie nagrywaj):*\n• Micro 1: ${microRep1.instruction}\n• Micro 2: ${microRep2.instruction}\n\n` +
    `➡️ Nagraj Rep A teraz.`
  );

  // Store repB instruction for after rep_a
  await updateRun(run.id, { phase: "rep_a" });

  return new Response("ok");
}

function escapeMd(text: string): string {
  return text.replace(/[_*[\]`]/g, (c) => "\\" + c);
}

async function handleStatus(chatId: number): Promise<Response> {
  const run = await getActiveRun();
  if (!run) {
    await sendMessage(chatId, "Brak aktywnego sprintu. Wyślij /start \u017ceby zacz\u0105\u0107.");
    return new Response("ok");
  }

  const day = run.current_day as number;
  const phase = run.phase as string;
  const attempts = run.attempts_on_day as number;
  const dayData = await getCurriculumDay(day);
  const focus = dayData ? escapeMd(dayData.focus as string) : "?";
  const constraint = dayData ? escapeMd(dayData.primary_constraint as string) : "?";

  // Get current rep instruction
  let drillLine = "";
  if (dayData) {
    const repData = dayData[phase] as Record<string, unknown> | undefined;
    if (repData?.instruction) {
      const dur = repData.duration_seconds ? ` (${repData.duration_seconds}s)` : "";
      drillLine = `\n\n*\u0106wiczenie${dur}:*\n${escapeMd(repData.instruction as string)}`;
    }
  }

  await sendMessage(
    chatId,
    `\u{1F4CA} *Dojo Status*\n\n` +
    `Dzie\u0144: ${day}/30\n` +
    `Faza: \`${phase}\`\n` +
    `Focus: ${focus}\n` +
    `Constraint: ${constraint}\n` +
    `Pr\u00f3by dzi\u015b: ${attempts}` +
    drillLine +
    `\n\n_Nagraj voice note \u017ceby kontynuowa\u0107._`
  );

  return new Response("ok");
}

async function handleTransferComplete(chatId: number): Promise<Response> {
  const run = await getActiveRun();
  if (!run) {
    await sendMessage(chatId, "Brak aktywnego sprintu.");
    return new Response("ok");
  }

  const phase = run.phase as string;
  if (phase !== "real_life_transfer") {
    await sendMessage(chatId, `Nie jesteś w fazie transfer. Aktualna faza: \`${phase}\``);
    return new Response("ok");
  }

  const currentDay = run.current_day as number;
  const dayData = await getCurriculumDay(currentDay);
  if (!dayData) return new Response("error");

  // Save self_check rep
  await saveRep({
    runId: run.id as string,
    day: currentDay,
    phase: "real_life_transfer",
    repType: "real_life_transfer",
    transcript: "self_check: done",
    audioDuration: 0,
    wordCount: 0,
    evalResult: { status: "self_check" },
    status: "self_check",
    parentRepId: null,
  });

  // Compute next state
  const { nextPhase, nextDay, pendingCorrectionId } = computeNextState(
    run,
    "pass",
    "",
    dayData
  );

  await updateRun(run.id as string, {
    phase: nextPhase,
    current_day: nextDay,
    attempts_on_day: 0,
    pending_correction_parent_rep_id: pendingCorrectionId,
  });

  const nextDayData = nextDay !== currentDay ? await getCurriculumDay(nextDay) : null;
  const instruction = buildNextInstruction(nextPhase, nextDay, currentDay, dayData, nextDayData);

  await sendMessage(chatId, instruction || `✅ Dzień ${currentDay} ukończony.`);
  return new Response("ok");
}

async function handleVoiceRep(message: Record<string, unknown>, chatId: number): Promise<Response> {
  const run = await getActiveRun();
  if (!run) {
    await sendMessage(chatId, "Brak aktywnego sprintu. Wyślij /start.");
    return new Response("ok");
  }

  const phase = run.phase as string;
  if (phase === "real_life_transfer" || phase === "completed") {
    await sendMessage(chatId, phase === "completed" ? "Sprint ukończony." : `Faza transfer — wyślij "done" gdy zrobisz real-life transfer.`);
    return new Response("ok");
  }

  const voiceObj = (message.voice || message.audio) as Record<string, unknown>;
  const fileId = voiceObj.file_id as string;

  await sendMessage(chatId, "⏳ Transkrybuję...");

  let transcript: string;
  let audioDuration: number;
  try {
    const result = await transcribeAudio(fileId);
    transcript = result.transcript;
    audioDuration = result.durationSeconds;
  } catch (err) {
    console.error("Transcription failed:", err);
    await sendMessage(chatId, "❌ Błąd transkrypcji. Spróbuj jeszcze raz.");
    return new Response("error");
  }

  const wordCount = countWords(transcript);
  const currentDay = run.current_day as number;
  const dayData = await getCurriculumDay(currentDay);
  if (!dayData) {
    await sendMessage(chatId, "Błąd: nie znaleziono dnia w curriculum.");
    return new Response("error");
  }

  const baselineStats = (run.baseline_stats as Record<string, unknown>) || null;

  // Evaluate
  let evalResult: EvalResult;
  try {
    evalResult = await evaluateRep(dayData, transcript, audioDuration, wordCount, baselineStats);
  } catch (err) {
    console.error("Evaluation failed:", err);
    await sendMessage(chatId, "❌ Błąd evaluation LLM. Spróbuj ponownie.");
    return new Response("error");
  }

  // Save rep
  const repId = await saveRep({
    runId: run.id as string,
    day: currentDay,
    phase,
    repType: phase as "rep_a" | "correction_rep_a" | "rep_b",
    transcript,
    audioDuration,
    wordCount,
    evalResult: { ...evalResult, rawContent: undefined },
    status: currentDay === 0 ? "diagnostic" : evalResult.status,
    parentRepId: (run.pending_correction_parent_rep_id as string) || null,
  });

  // Handle Day 0 baseline computation
  if (currentDay === 0) {
    if (phase === "rep_a") {
      // Advance to rep_b, store rep_a transcript temporarily in baseline_stats
      await updateRun(run.id as string, {
        phase: "rep_b",
        attempts_on_day: 1,
        baseline_stats: { rep_a_transcript: transcript, rep_a_duration: audioDuration },
      });

      const repB = dayData.rep_b as Record<string, unknown>;
      const microRep1 = dayData.micro_rep_1 as Record<string, unknown>;
      const microRep2 = dayData.micro_rep_2 as Record<string, unknown>;
      await sendMessage(
        chatId,
        `✅ Rep A zarejestrowana.\n\n` +
        `*Ćwicz solo (nie nagrywaj):*\n• ${microRep1.instruction}\n• ${microRep2.instruction}\n\n` +
        `🎯 *Rep B (${repB.duration_seconds}s):*\n${repB.instruction}\n\nNagraj teraz.`
      );
      return new Response("ok");
    }

    if (phase === "rep_b") {
      // Compute baseline from rep_a + rep_b
      const partialBaseline = baselineStats || ({} as Record<string, unknown>);
      const repATranscript = (partialBaseline.rep_a_transcript as string) || "";
      const repADuration = (partialBaseline.rep_a_duration as number) || 0;
      const finalBaseline = computeBaselineStats(repATranscript, repADuration, transcript, audioDuration);

      await updateRun(run.id as string, {
        phase: "real_life_transfer",
        attempts_on_day: 2,
        baseline_stats: finalBaseline,
      });

      const transfer = dayData.real_life_transfer as Record<string, unknown>;
      await sendMessage(
        chatId,
        `📊 *Baseline zapisany:*\n` +
        `• Tempo: ${(finalBaseline.words_per_second as number).toFixed(2)} słów/s\n` +
        `• Fillery: ${((finalBaseline.filler_density_estimate as number) * 100).toFixed(1)}%\n` +
        `• Śr. zdanie: ${(finalBaseline.sentence_length_avg as number).toFixed(1)} słów\n\n` +
        `🌍 *Transfer:*\n${transfer.instruction}\n\n✅ Gdy zrobisz: wyślij "done"`
      );
      return new Response("ok");
    }
  }

  // Regular days: build feedback + advance state
  const { nextPhase, nextDay, pendingCorrectionId } = computeNextState(run, evalResult.status, repId, dayData);

  await updateRun(run.id as string, {
    phase: nextPhase,
    current_day: nextDay,
    attempts_on_day: (run.attempts_on_day as number) + 1,
    pending_correction_parent_rep_id: pendingCorrectionId,
  });

  const evalMsg = buildEvalMessage(evalResult, dayData);
  const nextDayData = nextDay !== currentDay ? await getCurriculumDay(nextDay) : null;
  const instructionMsg = buildNextInstruction(nextPhase, nextDay, currentDay, dayData, nextDayData);

  const fullMessage = [evalMsg, instructionMsg].filter(Boolean).join("\n\n---\n\n");
  await sendMessage(chatId, fullMessage || "✅");

  return new Response("ok");
}

// ---- Main handler ----

serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.message as Record<string, unknown> | undefined;
    if (!message) return new Response("ok");

    const chatId = (message.chat as Record<string, unknown>).id as number;
    if (chatId !== AUTHORIZED_CHAT_ID) {
      console.warn("Unauthorized chat:", chatId);
      return new Response("unauthorized");
    }

    const text = (message.text as string) || "";

    if (text.startsWith("/start")) return handleStart(chatId);
    if (text.startsWith("/status")) return handleStatus(chatId);
    if (/^(done|gotowe|transfer done|transfer|✓|✅)/i.test(text.trim())) return handleTransferComplete(chatId);
    if (message.voice || message.audio) return handleVoiceRep(message, chatId);

    await sendMessage(chatId, "Wyślij voice note albo użyj /start · /status");
    return new Response("ok");
  } catch (err) {
    console.error("dojo-telegram error:", err);
    return new Response("error", { status: 500 });
  }
});
