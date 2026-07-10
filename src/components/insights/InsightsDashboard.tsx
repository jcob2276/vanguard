import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
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
import { TrendChart } from '../widgets/TrendChart';
import { BarChartWidget } from '../widgets/BarChart';
import { DetailPageLayout } from '../ui/DetailPageLayout';
import { Card } from '../ui/Card';

export function InsightsDashboard({ session }: { session: Session }) {
  const { data: snapshot, loading: statsLoading } = useUserStatsSnapshot(session);
  const [cards, setCards] = useState<InsightCardData[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [detailCard, setDetailCard] = useState<InsightCardData | null>(null);
  const userId = session.user.id;

  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const data = await fetchInsightCards(userId);
      setCards(data);
    } catch (err) {
      console.error('[fetchCards]', err);
    } finally {
      setCardsLoading(false);
    }
  }, [userId]);

  useEffect(() => { void (async () => { await fetchCards(); })(); }, [fetchCards]);

  const activityTrend = useMemo(() => {
    if (!snapshot?.daily?.length) return null;
    const points = [...snapshot.daily].reverse().slice(-14).map((d) => ({
      label: d.date.slice(5),
      value: d.inputs,
    }));
    return { points, unit: 'wpisów', color: '#5B6CFF' };
  }, [snapshot]);

  const activityBars = useMemo(() => {
    if (!snapshot?.daily?.length) return null;
    const points = [...snapshot.daily].reverse().slice(-7).map((d) => ({
      label: d.date.slice(5),
      value: d.inputs + d.completedTodos,
    }));
    return { points, color: '#10B981' };
  }, [snapshot]);

  const handlePin = useCallback(async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    try {
      await pinInsightCard(id, !card.isPinned);
      fetchCards();
      notify('Zmieniono status przypięcia.', 'success');
    } catch (err) {
      console.error('[handlePin]', err);
      notify('Nie udało się zmienić przypięcia karty.', 'error');
    }
  }, [cards, fetchCards]);

  const handleSort = useCallback(async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const newOrder = card.sortOrder > 0 ? card.sortOrder - 1 : 0;
    try {
      await sortInsightCard(id, newOrder);
      fetchCards();
    } catch (err) {
      console.error('[handleSort]', err);
      notify('Nie udało się zmienić kolejności karty.', 'error');
    }
  }, [cards, fetchCards]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteInsightCard(id);
      setCards(prev => prev.filter(c => c.id !== id));
      if (detailCard?.id === id) setDetailCard(null);
      notify('Karta została usunięta.', 'success');
    } catch (err) {
      console.error('[handleDelete]', err);
      notify('Nie udało się usunąć karty.', 'error');
    }
  }, [detailCard]);

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

      {activityTrend && (
        <Card variant="glass" padding="16px">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-text-tertiary mb-3">Aktywność — trend</p>
          <TrendChart data={activityTrend} />
        </Card>
      )}

      {activityBars && (
        <Card variant="glass" padding="16px">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-text-tertiary mb-3">Aktywność — 7 dni</p>
          <BarChartWidget data={activityBars} />
        </Card>
      )}

      <PatternsView session={session} />

      {cards.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-tertiary)' }}>
            Insights ({cards.length})
          </p>
          {cards.map(card => (
            <button
              key={card.id}
              type="button"
              className="w-full text-left"
              onClick={() => setDetailCard(card)}
            >
              <InsightCard
                card={card}
                onPin={handlePin}
                onSort={handleSort}
                onDelete={handleDelete}
              />
            </button>
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
