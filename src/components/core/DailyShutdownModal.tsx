import { useEffect, useState } from "react";
import { X, ChevronRight, ChevronLeft, Send, Sparkles, Smile, Flame, Award } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getTodayWarsaw } from "../../lib/date";
import { notify } from "../../lib/notify";

interface Props {
  session: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DailyShutdownModal({ session, onClose, onSaved }: Props) {
  const userId = session?.user?.id as string | undefined;
  const today = getTodayWarsaw();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1); // Step 1: Checklist preview & actual accomplishment notes, Step 2: Rating/Reflection, Step 3: Success Screen

  const [todayWin, setTodayWin] = useState<any>(null);
  const [completedTasks, setCompletedTasks] = useState<boolean[]>([false, false, false, false, false]);
  const [reflectionText, setReflectionText] = useState("");
  const [actualAccomplishmentText, setActualAccomplishmentText] = useState("");
  const [moodScore, setMoodScore] = useState(3);
  const [rpeScore, setRpeScore] = useState(5);
  const [dayScore, setDayScore] = useState(7);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("daily_wins")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setTodayWin(data);
          setCompletedTasks([
            !!data.done_1,
            !!data.done_2,
            !!data.done_3,
            !!data.done_4,
            !!data.done_5,
          ]);
          setReflectionText(data.day_note || "");
          setActualAccomplishmentText(data.journal_entry || "");
          setMoodScore(data.mood_score || 3);
          setRpeScore(data.daily_rpe || 5);
        }

        const { data: recon } = await supabase
          .from("daily_reconciliations")
          .select("day_score")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();
        
        if (recon && recon.day_score !== null) {
          setDayScore(recon.day_score);
        }
      } catch (err) {
        console.error("Error fetching today win for shutdown:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  const handleSaveShutdown = async () => {
    if (!userId || !todayWin) return;
    setSaving(true);
    try {
      const activeTasksCount = [1, 2, 3, 4, 5].filter((i) => todayWin["task_" + i]?.trim()).length;
      const doneCount = [1, 2, 3, 4, 5].filter((i, idx) => todayWin["task_" + i]?.trim() && completedTasks[idx]).length;
      const allDone = activeTasksCount > 0 && doneCount === activeTasksCount;
      const result = allDone ? "Z" : "P";

      // 1. Update daily_wins (journal_entry stores the actual accomplishments note)
      const patch = {
        day_note: reflectionText.trim(),
        journal_entry: actualAccomplishmentText.trim(),
        mood_score: moodScore,
        daily_rpe: rpeScore,
        result,
      };
      
      const { error: winErr } = await supabase
        .from("daily_wins")
        .update(patch)
        .eq("id", todayWin.id);
      
      if (winErr) throw winErr;

      // 2. Update daily_reconciliations
      const { data: recon } = await supabase
        .from("daily_reconciliations")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (recon) {
        await supabase
          .from("daily_reconciliations")
          .update({ day_score: dayScore })
          .eq("id", recon.id);
      } else {
        await supabase
          .from("daily_reconciliations")
          .insert({ user_id: userId, date: today, day_score: dayScore });
      }

      // 3. Insert stream log
      const reflectionPart = reflectionText.trim() ? " | Refleksja: " + reflectionText.trim() : "";
      const accomplishmentPart = actualAccomplishmentText.trim() ? " | Co zrobiono: " + actualAccomplishmentText.trim() : "";
      
      await supabase.from("vanguard_stream").insert({
        user_id: userId,
        source: "daily_shutdown",
        content: "Domknięcie dnia: Wynik " + dayScore + "/10 (Samopoczucie: " + moodScore + "/5, RPE: " + rpeScore + "/10)" + reflectionPart + accomplishmentPart,
        metadata: { kind: "day_close", date: today, day_score: dayScore, mood: moodScore, rpe: rpeScore },
      });

      if (onSaved) onSaved();
      setStep(3); // Go to success screen
    } catch (err) {
      console.error("Error saving daily shutdown:", err);
      notify("Nie udało się zamknąć dnia", "error");
    } finally {
      setSaving(false);
    }
  };

  const tasksList = todayWin
    ? [1, 2, 3, 4, 5]
        .map((i, idx) => ({
          title: todayWin["task_" + i],
          todoId: todayWin["task_" + i + "_todo_id"],
          done: completedTasks[idx],
          idx,
        }))
        .filter((t) => t.title?.trim())
    : [];

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-2xl bg-background border border-border-custom/50 p-6 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-[12px] font-bold text-text-muted">Wczytywanie rytuału wieczornego...</span>
        </div>
      </div>
    );
  }

  if (!todayWin) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
        <div className="relative w-full max-w-sm rounded-2xl bg-background border border-border-custom/60 shadow-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold">!</div>
          <h2 className="text-[15px] font-black text-text-primary">Brak planu na dziś</h2>
          <p className="text-[12px] text-text-muted">Rytuał poranny nie został ukończony na dzisiejszy dzień, więc nie możemy go dzisiaj rozliczyć.</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all">
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-background border border-border-custom/60 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[680px] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-black text-text-primary uppercase tracking-wider">Domknięcie Dnia</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-text-muted">{today}</span>
              {step < 3 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">Krok {step} z 2</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {step < 3 && (
          <div className="grid grid-cols-2 h-1 bg-border-custom/20 shrink-0">
            <div className={`h-full transition-all duration-300 ${step >= 1 ? "bg-indigo-500" : "bg-transparent"}`} />
            <div className={`h-full transition-all duration-300 ${step >= 2 ? "bg-indigo-500" : "bg-transparent"}`} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          
          {/* STEP 1: Power List Preview & Actual Accomplishment Notes */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">Twoje Zwycięstwa na dziś (Power List)</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Podgląd dzisiejszego planu i jego realizacji.</p>
              </div>

              {tasksList.length === 0 ? (
                <div className="py-8 text-center text-text-muted/50 italic text-[12px]">
                  Brak zadań w Power List na dziś.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasksList.map((task) => (
                    <div
                      key={task.idx}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        task.done
                          ? "border-emerald-500/20 bg-emerald-500/[0.015] text-text-primary"
                          : "border-border-custom/60 bg-surface/50 text-text-muted"
                      }`}
                    >
                      <span className={`text-[12px] font-semibold ${task.done ? "line-through opacity-75" : ""}`}>
                        {task.title}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        task.done ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                      }`}>
                        {task.done ? "Zrobione" : "Niezrobione"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment text area */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-text-primary block">
                  Co realnie zrobiłeś z dzisiejszych zadań? (Opcjonalnie)
                </span>
                <textarea
                  value={actualAccomplishmentText}
                  onChange={(e) => setActualAccomplishmentText(e.target.value)}
                  placeholder="Napisz, co faktycznie udało się zrealizować (np. Zrobiłem siłownię, ale skróciłem trening o połowę lub Zgłosiłem zadanie, ale muszę poprawić szczegóły)."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-[12px] font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-indigo-500/50 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Ratings & Reflection */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[13px] font-black text-text-primary">Refleksja wieczorna i Ocena</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Podsumuj krótko dzisiejszy dzień i oceń swoje samopoczucie.</p>
              </div>

              <div className="space-y-3.5 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 p-4 rounded-2xl">
                {/* Day Score */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-text-primary">
                      <Award size={14} className="text-indigo-500" />
                      Wynik Dnia (1-10)
                    </span>
                    <span className="text-indigo-500 font-extrabold">{dayScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={dayScore}
                    onChange={(e) => setDayScore(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 rounded bg-border-custom/40"
                  />
                </div>

                {/* Mood Score */}
                <div className="space-y-1.5 border-t border-border-custom/30 pt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-text-primary">
                      <Smile size={14} className="text-emerald-500" />
                      Samopoczucie (1-5)
                    </span>
                    <span className="text-emerald-500 font-extrabold">
                      {moodScore === 5 ? "🔥 Świetnie" : moodScore === 4 ? "😊 Dobrze" : moodScore === 3 ? "😐 Neutralnie" : moodScore === 2 ? "🥱 Słabo" : "😫 Źle"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={moodScore}
                    onChange={(e) => setMoodScore(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded bg-border-custom/40"
                  />
                </div>

                {/* RPE Score */}
                <div className="space-y-1.5 border-t border-border-custom/30 pt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-text-primary">
                      <Flame size={14} className="text-amber-500" />
                      Odczuwalny wysiłek RPE (1-10)
                    </span>
                    <span className="text-amber-500 font-extrabold">RPE {rpeScore}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rpeScore}
                    onChange={(e) => setRpeScore(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 rounded bg-border-custom/40"
                  />
                </div>
              </div>

              {/* Day Note reflection */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-text-primary block">Refleksja (Co poszło inaczej i dlaczego?)</span>
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="Zapisz refleksję, np. Zgłosiłem zadanie, ale nie zrobiłem cardio. Jutro pilnuję limitu."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-[12px] font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-indigo-500/50 outline-none transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/5">
                <Sparkles />
              </div>
              <div className="space-y-1">
                <h2 className="text-[16px] font-black text-text-primary uppercase tracking-wider">Dzień Zamknięty</h2>
                <p className="text-[12px] text-text-muted">Praca została mentalnie domknięta. Czas na odpoczynek i regenerację.</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/40 rounded-2xl w-full text-left space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-text-primary">
                  <span>Wynik Dnia:</span>
                  <span className="text-indigo-500 font-black">{dayScore}/10</span>
                </div>
                {actualAccomplishmentText.trim() && (
                  <div className="text-[10px] text-text-muted mt-1 pt-1.5 border-t border-border-custom/20">
                    <span className="font-bold text-text-secondary block">Co realnie zrobione:</span>
                    <p className="italic mt-0.5 break-words"> {actualAccomplishmentText.trim()} </p>
                  </div>
                )}
                {reflectionText.trim() && (
                  <div className="text-[10px] text-text-muted mt-1 pt-1.5 border-t border-border-custom/20">
                    <span className="font-bold text-text-secondary block">Refleksja wieczorna:</span>
                    <p className="italic mt-0.5 break-words"> {reflectionText.trim()} </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-3 rounded-xl border border-border-custom/80 text-text-primary text-[12px] font-black hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all flex items-center gap-1.5"
            >
              <ChevronLeft size={16} />
              Wróć
            </button>
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto"
            >
              Dalej
              <ChevronRight size={16} />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleSaveShutdown}
              disabled={saving}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto shadow-lg shadow-indigo-600/10 disabled:opacity-40"
            >
              <Send size={14} />
              {saving ? "Zamykam dzień..." : "Zatwierdź zamknięcie"}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all text-center shadow-lg shadow-indigo-600/10"
            >
              Zamknij i odpocznij
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
