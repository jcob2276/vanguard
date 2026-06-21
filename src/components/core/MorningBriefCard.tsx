import { getTodayWarsaw } from '../../lib/date';
import { useEffect, useState } from 'react';
import { Sunrise, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gatherUserContext } from '../../lib/aiContext';

const BRIEF_PROMPT = `Przygotuj zwięzły poranny brief dnia. Odpowiedz w 4-6 krótkich akapitach po polsku. Użyj danych z today_plan, open_todos i upcoming_checkpoints z kontekstu:

1. Stan ciała (sen, HRV, gotowość) — jedna konkretna liczba/ocena
2. Jeden główny ruch na dziś — wskaż konkretne zadanie z open_todos jeśli pasuje do priorytetu
3. Co odciąć / co zignorować — wymień 1-2 rzeczy które NIE są dziś ważne
4. Pułapka lub ryzyko — co może wysadzić dzień (na podstawie trybu, wzorców)
5. Jedno zdanie wzmacniające — konkretne, nie ogólnikowe

Bądź bezpośredni. Nie lej wody. Bez nagłówków — pisz jak briefing operacyjny. Jeśli tryb to rescue, zacznij od tego i skróć listę do absolutnego minimum.`;

const CACHE_HOURS = 8;

export default function MorningBriefCard({ session }: { session: any }) {
  const userId = session?.user?.id;
  const today = getTodayWarsaw();

  const [brief, setBrief] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('morning_briefs')
      .select('content, generated_at')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          const age = (Date.now() - new Date(data.generated_at).getTime()) / 3600000;
          if (age < CACHE_HOURS) {
            setBrief(data.content);
            setGeneratedAt(data.generated_at);
          }
        }
        setChecked(true);
      });
  }, [userId, today]);

  const generate = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const stateVector = await gatherUserContext(session);
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: [],
          current_query: BRIEF_PROMPT,
          user_id: userId,
          mode: 'morning_brief',
        },
      });
      if (error) throw error;
      const text: string = data?.text ?? data?.response ?? '';
      if (!text) throw new Error('Brak odpowiedzi');
      setBrief(text);
      const now = new Date().toISOString();
      setGeneratedAt(now);
      await supabase.from('morning_briefs').upsert(
        { user_id: userId, date: today, content: text, generated_at: now },
        { onConflict: 'user_id,date' }
      );
    } catch (e: any) {
      setBrief(`Błąd generowania: ${e.message ?? 'nieznany'}`);
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = async () => {
    setBrief(null);
    const { error: delErr } = await supabase.from('morning_briefs').delete().eq('user_id', userId).eq('date', today);
    if (delErr) console.warn('[MorningBriefCard] delete failed:', delErr.message);
    await generate();
  };

  if (!checked) return null;

  // Compact collapsed state — no brief yet
  if (!brief) {
    return (
      <button
        onClick={generate}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-[24px] border border-amber-500/10 bg-amber-500/[0.03] p-4 text-left transition-all hover:bg-amber-500/[0.07] active:scale-[0.98] cursor-pointer disabled:opacity-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sunrise size={16} />}
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/60">Brief dnia</p>
          <p className="text-[13px] font-black text-text-primary mt-0.5">
            {loading ? 'Generuję...' : 'Generuj poranny brief'}
          </p>
        </div>
      </button>
    );
  }

  return (
    <section className="rounded-[24px] border border-amber-500/15 bg-amber-500/[0.04] p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise size={13} className="text-amber-500" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/70">Brief dnia</p>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading}
          className="rounded-full p-1.5 text-text-muted hover:text-amber-500 transition-all cursor-pointer disabled:opacity-30"
          title="Odśwież brief"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-2">
        {brief.split('\n').filter(l => l.trim()).map((para, i) => (
          <p key={i} className="text-[12px] leading-relaxed text-text-primary font-medium">{para}</p>
        ))}
        {generatedAt && (
          <p className="text-[9px] text-text-muted pt-1">
            {new Date(generatedAt).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' })}
            {' · '}odświeża co {CACHE_HOURS}h
          </p>
        )}
      </div>
    </section>
  );
}
