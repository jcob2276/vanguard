import { useEffect, useState, useRef } from 'react';
import { Search, X, Sparkles, CheckCircle2, Bookmark, Folder } from 'lucide-react';
import Spinner from '../ui/Spinner';
import type { Session } from '@supabase/supabase-js';
import { notify } from '../../lib/notify';
import { invokeEdge } from '../../lib/supabase';
import Modal from '../ui/Modal';

interface GraphSearchResult {
  source_entity: string;
  relation: string;
  target_entity: string;
  fact_text: string | null;
}

interface TodoSearchResult {
  id: string;
  title: string;
  status: string;
  notes: string | null;
}

interface ProjectSearchResult {
  id: string;
  name: string;
  status: string;
  goal: string | null;
}

interface NoteSearchResult {
  id: string;
  title: string | null;
  content: string | null;
}

interface Props {
  session: Session;
  onClose: () => void;
}

export default function SearchModal({ session, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    graph: GraphSearchResult[];
    todos: TodoSearchResult[];
    projects: ProjectSearchResult[];
    notes: NoteSearchResult[];
  }>({ graph: [], todos: [], projects: [], notes: [] });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      void (async () => {
        setResults({ graph: [], todos: [], projects: [], notes: [] });
      })();
      return;
    }

    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await invokeEdge<{
          graph: GraphSearchResult[];
          todos: TodoSearchResult[];
          projects: ProjectSearchResult[];
          notes: NoteSearchResult[];
        }>('vanguard-oracle', {
          body: { query: query.trim(), action: 'search' },
        });

        setResults({
          graph: data.graph || [],
          todos: data.todos || [],
          projects: data.projects || [],
          notes: data.notes || [],
        });
      } catch (err: unknown) {
        console.error('[Search Error]', err);
        notify('Błąd podczas wyszukiwania', 'error');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(delay);
  }, [query, session.access_token]);

  const hasResults =
    results.graph.length > 0 ||
    results.todos.length > 0 ||
    results.projects.length > 0 ||
    results.notes.length > 0;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      showCloseButton={false}
      padding="p-0"
      overflowY={false}
      size="2xl"
      overlayClassName="items-start pt-[10vh]"
      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[75vh] animate-scaleUp"
    >
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
          <Spinner size="sm" className="!border-indigo-400/30 !border-t-indigo-400 shrink-0" />
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
              {results.graph.map((item, i) => (
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
              {results.todos.map((todo) => (
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
              {results.projects.map((proj) => (
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
              {results.notes.map((note) => (
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
    </Modal>
  );
}
