import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CornerDownLeft, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invokeEdge } from '../../lib/supabase';
import { notify } from '../../lib/notify';
import { subscribeActionHistory, type ActionHistorySnapshot } from '../../lib/actionHistory';
import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { createCommandCatalog, filterCommands } from './commandCenter/commandCatalog';
import { CommandRows } from './commandCenter/CommandRows';
import {
  commandsToRows,
  searchToRows,
  type SearchResults,
} from './commandCenter/commandRowsModel';

const EMPTY_RESULTS: SearchResults = { graph: [], todos: [], projects: [], notes: [] };

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [history, setHistory] = useState<ActionHistorySnapshot>({ undoLabel: null, redoLabel: null, busy: false });
  const commands = useMemo(() => createCommandCatalog({ navigate, close: onClose }), [navigate, onClose]);
  const matchingCommands = useMemo(() => filterCommands(commands, query), [commands, query]);
  const visibleResults = query.trim() ? results : EMPTY_RESULTS;
  const rows = useMemo(() => [
    ...commandsToRows(matchingCommands),
    ...searchToRows(visibleResults, navigate, onClose),
  ], [matchingCommands, visibleResults, navigate, onClose]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => subscribeActionHistory(setHistory), []);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await invokeEdge('vanguard-oracle', {
          body: { query: trimmed, action: 'search' },
          signal: controller.signal,
        }) as Partial<SearchResults>;
        setResults({
          graph: data.graph || [],
          todos: data.todos || [],
          projects: data.projects || [],
          notes: data.notes || [],
        });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          console.error('[CommandCenter] Search failed:', error);
          notify('Nie udało się przeszukać wszystkich danych.', 'error');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && rows[activeIndex]) {
      event.preventDefault();
      void rows[activeIndex].run();
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      padding="p-0"
      overflowY={false}
      size="2xl"
      overlayClassName="items-start pt-[var(--ds-arbitrary-10vh)]"
      className="flex max-h-[var(--ds-h-75vh)] flex-col overflow-hidden rounded-2xl border border-border-custom bg-surface-2 shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-border-custom px-4 py-3">
        <Search size={18} className="shrink-0 text-text-muted" />
        <ControlInput
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Szukaj albo wpisz, co chcesz zrobić…"
          aria-label="Centrum komend Vanguard"
          className="flex-1 bg-transparent text-base font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        {loading ? <Spinner size="sm" /> : (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zamknij centrum komend" className="h-8 w-8 rounded-full p-0"><X size={16} /></Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-1 pt-3 text-2xs font-bold uppercase tracking-widest text-text-muted">
          {query.trim() ? 'Najlepsze dopasowania' : 'Szybkie działania'}
        </div>
        {rows.length ? (
          <CommandRows items={rows} activeIndex={activeIndex} onActiveIndex={setActiveIndex} />
        ) : (
          <div className="px-6 py-12 text-center text-sm text-text-muted">Brak pasujących komend i wyników.</div>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-border-custom px-4 py-2 text-2xs font-semibold text-text-muted">
        <span className="inline-flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> wybierz</span>
        <span className="inline-flex items-center gap-1"><CornerDownLeft size={11} /> wykonaj</span>
        <span className="ml-auto truncate">{history.undoLabel ? `Cofnij: ${history.undoLabel}` : 'Esc zamyka'}</span>
      </div>
    </Modal>
  );
}
