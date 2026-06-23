import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useUserStatsSnapshot } from '../../hooks/useUserStatsSnapshot';
import { UserStatsOverviewCard } from './UserStatsOverviewCard';
import { InsightCard, type InsightCardData } from './InsightCard';

export function InsightsDashboard({ session }: { session: Session }) {
  const { data: snapshot, loading: statsLoading } = useUserStatsSnapshot(session);
  const [cards, setCards] = useState<InsightCardData[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const userId = session.user.id;

  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    const { data } = await supabase
      .from('knowledge_insight_cards')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    setCards((data ?? []).map(row => ({
      id: row.id,
      templateId: row.template_id,
      title: row.title,
      insight: row.insight,
      widgetData: row.widget_data ?? {},
      isPinned: row.is_pinned ?? false,
      sortOrder: row.sort_order ?? 0,
    })));
    setCardsLoading(false);
  }, [userId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handlePin = useCallback(async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    await supabase.from('knowledge_insight_cards').update({ is_pinned: !card.isPinned }).eq('id', id);
    fetchCards();
  }, [cards, fetchCards]);

  const handleSort = useCallback(async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const newOrder = card.sortOrder > 0 ? card.sortOrder - 1 : 0;
    await supabase.from('knowledge_insight_cards').update({ sort_order: newOrder }).eq('id', id);
    fetchCards();
  }, [cards, fetchCards]);

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('knowledge_insight_cards').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <div className="space-y-5">
      <UserStatsOverviewCard snapshot={snapshot} loading={statsLoading} />

      {cards.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-tertiary)' }}>
            Insights ({cards.length})
          </p>
          {cards.map(card => (
            <InsightCard
              key={card.id}
              card={card}
              onPin={handlePin}
              onSort={handleSort}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {!cardsLoading && cards.length === 0 && (
        <p className="text-center text-[12px] py-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Brak insight cards — Oracle wygeneruje je automatycznie.
        </p>
      )}
    </div>
  );
}
