import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';
import { useEffect, useState, useRef } from 'react';
import { Search, X, Sparkles, CheckCircle2, Bookmark, Folder } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { useSession } from '../../store/useStore';
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
  onClose: () => void;
}

export default function SearchModal({ onClose }: Props) {
  const session = useSession();
  const accessToken = session?.access_token;
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
        const data = await invokeEdge('vanguard-oracle', {
          body: { query: query.trim(), action: 'search' },
        }) as {
          graph: GraphSearchResult[];
          todos: TodoSearchResult[];
          projects: ProjectSearchResult[];
          notes: NoteSearchResult[];
        };

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
  }, [query, accessToken]);

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
      overlayClassName="items-start pt-[var(--ds-arbitrary-10vh)]"
      className="bg-surface-2 border border-border-custom rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[var(--ds-h-75vh)] animate-scaleUp"
    >
      {/* Search Input Bar */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-custom bg-surface-2/40">
        <Search size={16} className="text-text-muted shrink-0" />
        <ControlInput
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj wiedzy, zadań, notatek, projektów..."
          className="flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted font-semibold"
        />
        {loading ? (
          <Spinner size="sm" className="!border-primary/30 !border-t-indigo-400 shrink-0" />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary shrink-0"
          >
            <X size={16} />
          </Button>
        )}
      </div>

      {/* Scrollable Results Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {!query.trim() && (
          <div className="text-center py-10 text-text-muted">
            <Search className="mx-auto mb-2 text-text-muted" size={24} />
            <p className="text-sm font-semibold">Wpisz frazę, aby rozpocząć globalne wyszukiwanie</p>
            <p className="text-xs text-text-muted mt-1">Przeszukuje bazę wiedzy (graf), zadania, projekty i notatki</p>
          </div>
        )}

        {query.trim() && !loading && !hasResults && (
          <div className="text-center py-10 text-text-muted">
            <p className="text-sm font-semibold">Brak wyników dla zapytania "{query}"</p>
          </div>
        )}

        {/* Graph Results */}
        {results.graph.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary px-1">
              <Sparkles size={12} />
              <span>Baza Wiedzy (Graf)</span>
            </div>
            <div className="grid gap-2">
              {results.graph.map((item, i) => (
                <div
                  key={i}
                  className="p-3 bg-primary/20 hover:bg-primary/30 border border-primary/30 hover:border-primary/40 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <span>{item.source_entity}</span>
                    <span className="text-text-muted font-medium">→</span>
                    <span className="text-primary px-1.5 py-0.2 rounded bg-primary/30 font-medium">{item.relation}</span>
                    <span className="text-text-muted font-medium">→</span>
                    <span>{item.target_entity}</span>
                  </div>
                  {item.fact_text && (
                    <p className="text-sm text-text-secondary mt-1.5 font-medium leading-relaxed">
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
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success px-1">
              <CheckCircle2 size={12} />
              <span>Zadania (Todos)</span>
            </div>
            <div className="grid gap-2">
              {results.todos.map((todo) => (
                <div
                  key={todo.id}
                  className="p-3 bg-success/10 hover:bg-success/20 border border-success/20 hover:border-success/30 rounded-xl transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-success">{todo.title}</span>
                    <span className="text-2xs uppercase font-black px-1.5 py-0.5 rounded bg-success/30 text-success">
                      {todo.status}
                    </span>
                  </div>
                  {todo.notes && (
                    <p className="text-xs text-text-muted mt-1 font-semibold truncate">
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
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warning px-1">
              <Folder size={12} />
              <span>Projekty</span>
            </div>
            <div className="grid gap-2">
              {results.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3 bg-warning/10 hover:bg-warning/20 border border-warning/20 hover:border-warning/30 rounded-xl transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-warning">{proj.name}</span>
                    <span className="text-2xs uppercase font-black px-1.5 py-0.5 rounded bg-warning/30 text-warning">
                      {proj.status}
                    </span>
                  </div>
                  {proj.goal && (
                    <p className="text-xs text-text-muted mt-1 font-semibold truncate">
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
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-info px-1">
              <Bookmark size={12} />
              <span>Notatki</span>
            </div>
            <div className="grid gap-2">
              {results.notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-info/10 hover:bg-info/20 border border-info/20 hover:border-info/30 rounded-xl transition-all"
                >
                  <span className="text-sm font-bold text-info block">{note.title || '(Bez tytułu)'}</span>
                  {note.content && (
                    <p className="text-xs text-text-muted mt-1 font-semibold line-clamp-2 leading-relaxed">
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
      <div className="px-4 py-2 bg-surface-2/40 border-t border-border-custom flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-text-muted">
        <span>ESC, aby zamknąć</span>
        <span>Przeszukiwanie zasilane hybrydowo (FTS + Vector)</span>
      </div>
    </Modal>
  );
}
