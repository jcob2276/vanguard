import { getTodayWarsaw } from '../../lib/date';
import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gatherUserContext } from '../../lib/aiContext';
import type { Session } from '@supabase/supabase-js';

type Msg = { role: 'user' | 'oracle'; text: string };

const PROMPTS_BY_MODE: Record<string, string[]> = {
  rescue: [
    'Jestem w trybie ratunkowym — co jest teraz najważniejsze?',
    'Skróć mój plan do 1 działania na dziś',
    'Co odcinam żeby przeżyć ten tydzień?',
    'Jak odblokować energię kiedy wszystko się wali?',
  ],
  minimal: [
    'Co zrobić żeby ten dzień był wygrany przy minimalnej energii?',
    'Jaki jest mój najważniejszy ruch przy niskiej energii?',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
  default: [
    'Jaki powinien być mój fokus dziś?',
    'Oceń mój tydzień i powiedz co poprawić',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
};

export default function OracleCard({ session }: { session: Session }) {
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const today = getTodayWarsaw();
    supabase
      .from('daily_reconciliations')
      .select('planning_summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        const m = (data?.planning_summary as any)?.mode;
        if (m) setCurrentMode(m);
      });
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const history = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const ask = async () => {
    const query = input.trim();
    if (!query || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setLoading(true);
    try {
      const stateVector = await gatherUserContext(session);
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: history.slice(-6),
          current_query: query,
          user_id: session.user.id,
          mode: 'chat',
        },
      });
      if (error) throw error;
      const reply = data?.text ?? data?.response ?? '(brak odpowiedzi)';
      setMessages(prev => [...prev, { role: 'oracle', text: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'oracle', text: `Błąd: ${e.message ?? 'nieznany'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 150); }}
        className="flex w-full items-center gap-3 rounded-[24px] border border-primary/10 bg-primary/[0.04] p-4 text-left transition-all hover:bg-primary/[0.08] active:scale-[0.98] cursor-pointer"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles size={16} />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Oracle</p>
          <p className="text-[13px] font-black text-text-primary mt-0.5">Zapytaj o swój stan</p>
        </div>
      </button>
    );
  }

  return (
    <section className="rounded-[24px] border border-primary/15 bg-surface backdrop-blur-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-custom">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-primary" />
          <span className="text-[11px] font-black uppercase tracking-wider text-primary">Oracle</span>
        </div>
        <button
          onClick={() => { setOpen(false); setMessages([]); }}
          className="rounded-full p-1.5 text-text-muted hover:bg-surface-solid hover:text-text-primary transition-all cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="py-2 space-y-2">
            <p className="text-[10px] text-text-muted text-center mb-3">
              Oracle ma dostęp do Twoich danych z ostatnich 48h.
            </p>
            {(PROMPTS_BY_MODE[currentMode] ?? PROMPTS_BY_MODE.default).map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="w-full text-left rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[11px] text-text-secondary hover:text-text-primary hover:border-primary/20 hover:bg-surface-solid transition-all cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-surface-solid border border-border-custom text-text-primary rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border-custom bg-surface-solid px-4 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border-custom px-4 py-3">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder="Jak wygląda mój sen w tym tygodniu?"
          disabled={loading}
          className="flex-1 bg-transparent text-[12px] font-medium text-text-primary placeholder:text-text-muted/40 outline-none"
        />
        <button
          onClick={ask}
          disabled={!input.trim() || loading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-30 hover:bg-primary-hover transition-all active:scale-95 cursor-pointer"
        >
          <Send size={13} />
        </button>
      </div>
    </section>
  );
}
