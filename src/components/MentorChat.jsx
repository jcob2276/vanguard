import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { gatherUserContext } from '../lib/aiContext';
import { VanguardCore, computeSignals } from '../lib/vanguardCore';
import { Send, Sparkles, RefreshCw, User, Bot, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function MentorChat({ session }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function fetchHistory() {
    setFetchingHistory(true);
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    
    if (!error && data) setMessages(data);
    setFetchingHistory(false);
  }

  async function clearHistory() {
    if (!confirm('Czy na pewno chcesz wyczyścić pamięć systemu?')) return;
    await supabase.from('ai_chat_messages').delete().eq('user_id', session.user.id);
    setMessages([]);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const rawInput = input.trim();
    const isDeep = rawInput.startsWith('!!');
    const userMessage = isDeep ? rawInput.substring(2).trim() : rawInput;
    setInput('');
    setLoading(true);

    // 1. Optimistically add user message
    const tempUserMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // 2. Gather Unified Vanguard Context (STATE_VECTOR 3.0)
      const vanguardContext = await gatherUserContext(session);

      // 3. Call AI via Unified Oracle
      const { data, error: functionError } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: vanguardContext,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          current_query: userMessage,
          user_id: session.user.id,
          thinking: isDeep, // !! = pro + think_high, domyślnie = flash + think
        }
      });

      if (functionError) throw functionError;

      const assistantMsg = data.text;

      // 4. Save to DB
      await supabase.from('ai_chat_messages').insert([
        { user_id: session.user.id, role: 'user', content: userMessage },
        { user_id: session.user.id, role: 'assistant', content: assistantMsg }
      ]);

      // 5. Zero-UI: Auto-Tagging Extraction
      const tags = userMessage.match(/#\w+/g);
      if (tags && tags.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: currentWins } = await supabase
          .from('daily_wins')
          .select('tags')
          .eq('user_id', session.user.id)
          .eq('date', today)
          .maybeSingle();

        if (currentWins) {
          const existingTags = currentWins.tags || [];
          const newTags = [...new Set([...existingTags, ...tags])];
          await supabase
            .from('daily_wins')
            .update({ tags: newTags })
            .eq('user_id', session.user.id)
            .eq('date', today);
        }
      }

      // Trim — zachowaj tylko ostatnie 200 wiadomości
      const { data: oldMsgs } = await supabase
        .from('ai_chat_messages')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(200, 9999);
      if (oldMsgs && oldMsgs.length > 0) {
        await supabase
          .from('ai_chat_messages')
          .delete()
          .in('id', oldMsgs.map(m => m.id));
      }

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Błąd połączenia z rdzeniem systemu.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-black border border-neutral-800 rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <header className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <Sparkles size={16} className="text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-tighter italic">Strategiczny Obserwator V4 Pro</h2>
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Aktywny • Think High Mode • Pełny Kontekst</p>
          </div>
        </div>
        <button onClick={clearHistory} className="text-neutral-600 hover:text-dayB transition-colors">
          <Trash2 size={14} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {fetchingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
             <RefreshCw size={24} className="text-neutral-800 animate-spin" />
             <p className="text-[10px] font-black text-neutral-800 uppercase tracking-widest">Inicjalizacja rdzenia...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.3em]">Oczekiwanie na sygnał...</p>
            <p className="text-xs text-neutral-500 italic max-w-[200px] mx-auto">Zadaj pytanie dotyczące swojej formy, wzorców lub dylematów dyscypliny.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${m.role === 'user' ? 'bg-neutral-800 border-neutral-700' : 'bg-primary/10 border-primary/20'}`}>
                  {m.role === 'user' ? <User size={12} className="text-neutral-400" /> : <Bot size={12} className="text-primary" />}
                </div>
                <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed ${m.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-neutral-950 text-neutral-300 border border-neutral-900 italic'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-neutral-900/30 border-t border-neutral-800">
        <div className="relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={loading ? "System generuje odpowiedź..." : "Napisz do systemu... (!! = tryb głęboki)"}
            className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-5 pr-14 text-xs text-white focus:border-primary/50 transition-colors outline-none placeholder:text-neutral-700 font-bold"
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
