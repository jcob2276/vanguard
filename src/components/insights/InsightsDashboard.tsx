import Button from '../ui/Button';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStatsSnapshot } from './hooks/useUserStatsSnapshot';
import { UserStatsOverviewCard } from './UserStatsOverviewCard';
import { InsightCard } from './InsightCard';
import {
  fetchInsightCards,
  pinInsightCard,
  sortInsightCard,
  deleteInsightCard,
  type InsightCardData
} from '../../lib/insightsApi';
import { notify } from '../../lib/notify';
import { PatternsView } from './PatternsView';
import { DetailPageLayout } from '../ui/DetailPageLayout';
import { Card } from '../ui/Card';
import { useUserId } from '../../store/useStore';

import { insightCardsKeys } from '../../lib/queryKeys';

export function InsightsDashboard() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: snapshot, loading: statsLoading } = useUserStatsSnapshot(userId!);
  const [detailCard, setDetailCard] = useState<InsightCardData | null>(null);

  const cardsQuery = useQuery({
    queryKey: insightCardsKeys.list(userId ?? ''),
    queryFn: () => fetchInsightCards(userId!),
    enabled: !!userId,
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const cardsLoading = cardsQuery.isLoading;


  const invalidate = useCallback(() => {
    if (!userId) return;
    void queryClient.invalidateQueries({ queryKey: insightCardsKeys.list(userId) });
  }, [queryClient, userId]);

  const handlePin = useCallback(async (id: string) => {
    if (!userId) return;
    const card = cards.find(c => c.id === id);
    if (!card) return;
    try {
      await pinInsightCard(id, !card.isPinned);
      invalidate();
      notify('Zmieniono status przypięcia.', 'success');
    } catch (err) {
      console.error('[handlePin]', err);
      notify('Nie udało się zmienić przypięcia karty.', 'error');
    }
  }, [cards, invalidate, userId]);

  const handleSort = useCallback(async (id: string) => {
    if (!userId) return;
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const newOrder = card.sortOrder > 0 ? card.sortOrder - 1 : 0;
    try {
      await sortInsightCard(id, newOrder);
      invalidate();
    } catch (err) {
      console.error('[handleSort]', err);
      notify('Nie udało się zmienić kolejności karty.', 'error');
    }
  }, [cards, invalidate, userId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteInsightCard(id);
      queryClient.setQueryData<InsightCardData[]>(insightCardsKeys.list(userId ?? ''), (prev) =>
        (prev ?? []).filter(c => c.id !== id)
      );
      if (detailCard?.id === id) setDetailCard(null);
      notify('Karta została usunięta.', 'success');
    } catch (err) {
      console.error('[handleDelete]', err);
      notify('Nie udało się usunąć karty.', 'error');
    }
  }, [detailCard, queryClient, userId]);

  if (!userId) return null;

  if (detailCard) {
    return (
      <DetailPageLayout title={detailCard.title} subtitle="Insight" onBack={() => setDetailCard(null)}>
        <InsightCard
          card={detailCard}
          onPin={handlePin}
          onSort={handleSort}
          onDelete={handleDelete}
          expanded
        />
      </DetailPageLayout>
    );
  }

  return (
    <div className="space-y-5">
      <UserStatsOverviewCard snapshot={snapshot} loading={statsLoading} />


      <PatternsView />

      {cards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-034)]" style={{ color: 'var(--color-text-tertiary)' }}>
            Insights ({cards.length})
          </p>
          {cards.map(card => (
            <Button
              key={card.id}
              variant="ghost"
              onClick={() => setDetailCard(card)}
              className="w-full min-w-0 p-0 text-left justify-start hover:bg-transparent"
            >
              <InsightCard
                card={card}
                onPin={handlePin}
                onSort={handleSort}
                onDelete={handleDelete}
              />
            </Button>
          ))}
        </div>
      )}

      {!cardsLoading && cards.length === 0 && (
        <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Brak insight cards — Oracle wygeneruje je automatycznie.
        </p>
      )}
    </div>
  );
}
