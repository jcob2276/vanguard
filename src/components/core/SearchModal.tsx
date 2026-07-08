import { useEffect, useState, useRef } from 'react';
import { Search, X, Loader2, Sparkles, CheckCircle2, Bookmark, Folder } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { notify } from '../../lib/notify';

interface SearchResult {
  graph: any[];
  todos: any[];
  projects: any[];
  notes: any[];
}

export default function SearchModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult>({ graph: [], todos: [], projects: [], notes: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ graph: [], todos: [], projects: [], notes: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const base = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${base}/functions/v1/vanguard-oracle?action=search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        setResults(data);
      } catch (err: unknown) {
        console.error('[Search Error]', err);
        notify('Wyszukiwanie nie powiodło się', 'error');
        setResults({ graph: [], todos: [], projects: [], notes: [] });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, session.access_token]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasResults =
    results.graph.length > 0 ||
    results.todos.length > 0 ||
    results.projects.length > 0 ||
    results.notes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 backdrop-blur-md bg-slate-950/70 animate-fade-in">
      {/* Backdrop click closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Command Palette Box */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[75vh] animate-scale-up">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj wiedzy, zadań, notatek, projektów..."
            className="flex-1 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-slate-500 font-semibold"
          />
          {loading ? (
            <Loader2 size={16} className="text-indigo-400 animate-spin shrink-0" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-text-primary transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Scrollable Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {!query.trim() && (
            <div className="text-center py-10 text-slate-500">
              <Search className="mx-auto mb-2 text-slate-600" size={24} />
              <p className="text-[12px] font-semibold">Wpisz frazę, aby rozpocząć globalne wyszukiwanie</p>
              <p className="text-[10px] text-slate-600 mt-1">Przeszukuje bazę wiedzy (graf), zadania, projekty i notatki</p>
            </div>
          )}

          {query.trim() && !loading && !hasResults && (
            <div className="text-center py-10 text-slate-500">
              <p className="text-[12px] font-semibold">Brak wyników dla zapytania "{query}"</p>
            </div>
          )}

          {/* Graph Results */}
          {results.graph.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-1">
                <Sparkles size={12} />
                <span>Baza Wiedzy (Graf)</span>
              </div>
              <div className="grid gap-2">
                {results.graph.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 bg-indigo-950/20 hover:bg-indigo-950/30 border border-indigo-900/30 hover:border-indigo-800/40 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-300">
                      <span>{item.source_entity}</span>
                      <span className="text-slate-500 font-medium">→</span>
                      <span className="text-indigo-400 px-1.5 py-0.2 rounded bg-indigo-900/30 font-medium">{item.relation}</span>
                      <span className="text-slate-500 font-medium">→</span>
                      <span>{item.target_entity}</span>
                    </div>
                    {item.fact_text && (
                      <p className="text-[12px] text-text-secondary mt-1.5 font-medium leading-relaxed">
                        {item.fact_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Todo Results */}
          {results.todos.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-1">
                <CheckCircle2 size={12} />
                <span>Zadania (Todos)</span>
              </div>
              <div className="grid gap-2">
                {results.todos.map((todo: any) => (
                  <div
                    key={todo.id}
                    className="p-3 bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-900/20 hover:border-emerald-800/30 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold text-emerald-300">{todo.title}</span>
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-950/30 text-emerald-400">
                        {todo.status}
                      </span>
                    </div>
                    {todo.notes && (
                      <p className="text-[11px] text-text-muted mt-1 font-semibold truncate">
                        {todo.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Results */}
          {results.projects.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 px-1">
                <Folder size={12} />
                <span>Projekty</span>
              </div>
              <div className="grid gap-2">
                {results.projects.map((proj: any) => (
                  <div
                    key={proj.id}
                    className="p-3 bg-amber-950/10 hover:bg-amber-950/20 border border-amber-900/20 hover:border-amber-800/30 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold text-amber-300">{proj.name}</span>
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-950/30 text-amber-400">
                        {proj.status}
                      </span>
                    </div>
                    {proj.goal && (
                      <p className="text-[11px] text-text-muted mt-1 font-semibold truncate">
                        {proj.goal}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Results */}
          {results.notes.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 px-1">
                <Bookmark size={12} />
                <span>Notatki</span>
              </div>
              <div className="grid gap-2">
                {results.notes.map((note: any) => (
                  <div
                    key={note.id}
                    className="p-3 bg-sky-950/10 hover:bg-sky-950/20 border border-sky-900/20 hover:border-sky-800/30 rounded-xl transition-all"
                  >
                    <span className="text-[12px] font-bold text-sky-300 block">{note.title || '(Bez tytułu)'}</span>
                    {note.content && (
                      <p className="text-[11px] text-text-muted mt-1 font-semibold line-clamp-2 leading-relaxed">
                        {note.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <span>ESC, aby zamknąć</span>
          <span>Przeszukiwanie zasilane hybrydowo (FTS + Vector)</span>
        </div>
      </div>
    </div>
  );
}
