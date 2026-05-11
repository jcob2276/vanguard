import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal, Send, MessageSquare } from 'lucide-react';

export default function ThoughtStream({ session }) {
  const [thought, setThought] = useState('');
  const [recentThoughts, setRecentThoughts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecent();
    const subscription = supabase
      .channel('vanguard_stream_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vanguard_stream' }, () => {
        fetchRecent();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchRecent() {
    const { data } = await supabase
      .from('vanguard_stream')
      .select('*')
      .eq('user_id', session.user.id)
      .order('timestamp', { ascending: false })
      .limit(3);
    if (data) setRecentThoughts(data);
  }

  async function sendThought(e) {
    if (e) e.preventDefault();
    if (!thought.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('vanguard_stream')
        .insert({
          user_id: session.user.id,
          source: 'web_thought',
          content: thought.trim()
        });
      
      if (error) throw error;
      setThought('');
    } catch (err) {
      console.error('Error sending thought:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 opacity-50">
        <Terminal size={14} className="text-primary" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Cognitive Stream</h3>
      </div>

      {/* Recent thoughts log */}
      <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 scrollbar-hide">
        {recentThoughts.map((t, i) => (
          <div key={t.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 100}ms` }}>
            <span className="text-[9px] font-mono text-primary/40 mt-1 whitespace-nowrap">
              {new Date(t.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <p className="text-[11px] text-neutral-400 font-medium leading-relaxed italic">
              {t.content}
            </p>
          </div>
        ))}
        {recentThoughts.length === 0 && (
          <p className="text-[10px] text-neutral-700 italic">Brak wpisów w strumieniu...</p>
        )}
      </div>

      <form onSubmit={sendThought} className="relative mt-2">
        <input 
          type="text"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder="Wpisz myśl / stan / refleksję..."
          className="w-full bg-neutral-900/50 border border-white/5 rounded-xl py-3 pl-4 pr-10 text-[11px] text-white placeholder:text-neutral-700 outline-none focus:border-primary/50 transition-all font-medium"
        />
        <button 
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:text-white transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
      
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Telegram Sync Active</span>
      </div>
    </div>
  );
}
