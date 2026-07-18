import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileText, Link2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invokeEdge } from '../../lib/supabase';
import { getPlainText } from '../notes/keepUtils';
import { Pressable } from '../ui/ControlPrimitives';

interface EventContextResult {
  graph: Array<{ source_entity: string; target_entity: string; relation: string; fact_text: string | null }>;
  notes: Array<{ id: string; title: string | null; content: string | null }>;
}

function isContextResult(value: Record<string, unknown>): value is Record<string, unknown> & EventContextResult {
  return Array.isArray(value.graph) && Array.isArray(value.notes);
}

export default function EventContextCard({ eventId, title }: { eventId: string; title: string }) {
  const navigate = useNavigate();
  const query = title.trim();
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-event-context', eventId, query],
    queryFn: async () => {
      const result = await invokeEdge('vanguard-oracle', {
        body: { query, action: 'search' },
      });
      return isContextResult(result) ? result : { graph: [], notes: [] };
    },
    enabled: query.length >= 3,
    staleTime: 5 * 60_000,
  });
  const notes = data?.notes?.slice(0, 2) || [];
  const facts = data?.graph?.filter((fact) => fact.fact_text).slice(0, 2) || [];

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-xl bg-surface-3/70" aria-label="Szukam powiązanego kontekstu" />;
  }
  if (!notes.length && !facts.length) return null;

  return (
    <aside className="rounded-xl border border-primary/15 bg-primary/5 p-3" aria-label="Powiązany kontekst wydarzenia">
      <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary">
        <Sparkles size={14} /> Przygotowanie
      </div>
      <div className="space-y-1.5">
        {notes.map((note) => (
          <Pressable
            key={note.id}
            onClick={() => navigate(`/keep?note=${note.id}`)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-primary/10"
          >
            <FileText size={14} className="shrink-0 text-primary/70" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-text-primary">{note.title || 'Bez tytułu'}</span>
              {note.content ? <span className="block truncate text-2xs text-text-muted">{getPlainText(note.content)}</span> : null}
            </span>
            <ArrowRight size={13} className="text-text-muted" />
          </Pressable>
        ))}
        {facts.map((fact, index) => (
          <div key={`${fact.source_entity}-${fact.target_entity}-${index}`} className="flex gap-2 rounded-lg px-2 py-1.5">
            <Link2 size={14} className="mt-0.5 shrink-0 text-primary/70" />
            <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{fact.fact_text}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-primary/10 pt-2 text-2xs text-text-muted">Kontekst pochodzi z Twoich notatek i potwierdzonej wiedzy.</p>
    </aside>
  );
}
