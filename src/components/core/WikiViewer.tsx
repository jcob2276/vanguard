import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, X, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

const TYPE_META: Record<string, { label: string; color: string }> = {
  behavior_pattern: { label: 'Wzorzec',        color: 'bg-rose-500/10 text-rose-500' },
  friction_loop:    { label: 'Friction loop',   color: 'bg-amber-500/10 text-amber-500' },
  health:           { label: 'Zdrowie',         color: 'bg-emerald-500/10 text-emerald-500' },
  identity:         { label: 'Tożsamość',       color: 'bg-violet-500/10 text-violet-500' },
  project:          { label: 'Projekt',         color: 'bg-sky-500/10 text-sky-500' },
  decision:         { label: 'Decyzja',         color: 'bg-indigo-500/10 text-indigo-500' },
  source_summary:   { label: 'Tematy',          color: 'bg-primary/10 text-primary' },
  operating_model:  { label: 'Model operacyjny',color: 'bg-primary/10 text-primary' },
};

function ConfidenceDot({ value }: { value: number }) {
  const cls = value >= 0.7 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-amber-400' : 'bg-rose-400';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} title={`Pewność: ${Math.round(value * 100)}%`} />;
}

function renderMd(md: string) {
  return md.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return <p key={i} className="text-[12px] font-black text-text-primary mt-3 mb-1">{line.slice(3)}</p>;
    }
    if (line.startsWith('# ')) {
      return <p key={i} className="text-[13px] font-black text-text-primary mt-3 mb-1">{line.slice(2)}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1');
      return (
        <div key={i} className="flex items-start gap-1.5 mt-1">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted/40" />
          <p className="text-[11px] leading-relaxed text-text-secondary">{text}</p>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    const text = line.replace(/\*\*(.*?)\*\*/g, '$1');
    return <p key={i} className="text-[11px] leading-relaxed text-text-secondary">{text}</p>;
  });
}

export default function WikiViewer({ session }: { session: any }) {
  const userId = session?.user?.id;
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('vanguard_wiki_pages')
      .select('id, slug, title, page_type, status, confidence, summary, content_md, last_compiled_at')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('last_compiled_at', { ascending: false })
      .then(({ data }) => {
        setPages(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  if (loading || pages.length === 0) return null;

  const needsReview = pages.filter(p => p.status === 'needs_review');
  const active = pages.filter(p => p.status === 'active');

  return (
    <>
      <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">
              Skompilowana wiedza Oracle · {pages.length}
            </p>
          </div>
          {needsReview.length > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-500">
              <AlertTriangle size={9} /> {needsReview.length} do przeglądu
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {pages.map(page => {
            const meta = TYPE_META[page.page_type] ?? { label: page.page_type, color: 'bg-border-custom text-text-muted' };
            const ago = page.last_compiled_at
              ? formatDistanceToNow(new Date(page.last_compiled_at), { locale: pl, addSuffix: true })
              : null;
            return (
              <button
                key={page.id}
                onClick={() => setSelected(page)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border-custom bg-surface-solid/40 px-3.5 py-2.5 text-left transition-all hover:bg-surface-solid hover:border-primary/20 active:scale-[0.98] cursor-pointer"
              >
                <ConfidenceDot value={Number(page.confidence)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-text-primary leading-tight">{page.title}</p>
                  {page.summary && (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">{page.summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                  {page.status === 'needs_review' && (
                    <AlertTriangle size={9} className="text-amber-500" />
                  )}
                </div>
                <ChevronRight size={12} className="shrink-0 text-text-muted/40" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-border-custom">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                    (TYPE_META[selected.page_type] ?? { color: 'bg-border-custom text-text-muted' }).color
                  }`}>
                    {(TYPE_META[selected.page_type] ?? { label: selected.page_type }).label}
                  </span>
                  <ConfidenceDot value={Number(selected.confidence)} />
                  <span className="text-[9px] text-text-muted">{Math.round(Number(selected.confidence) * 100)}% pewności</span>
                </div>
                <h3 className="text-[16px] font-black text-text-primary leading-tight">{selected.title}</h3>
                {selected.last_compiled_at && (
                  <p className="mt-1 flex items-center gap-1 text-[9px] text-text-muted">
                    <Clock size={9} />
                    {formatDistanceToNow(new Date(selected.last_compiled_at), { locale: pl, addSuffix: true })}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 text-text-muted hover:bg-surface-solid cursor-pointer shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5 space-y-0.5">
              {selected.content_md ? renderMd(selected.content_md) : (
                <p className="text-[11px] text-text-muted">Brak treści.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
