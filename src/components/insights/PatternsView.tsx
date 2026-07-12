import { notify } from '../../lib/notify';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Brain } from 'lucide-react';
import { PatternCard } from './PatternCard';
import { listActivePatterns, triggerPatternDetection, type BehavioralPattern as PatternData } from '../../lib/insightsApi';
import { useUserId } from '../../store/useStore';

const patternsKeys = {
  all: ['patterns'] as const,
  list: (userId: string) => [...patternsKeys.all, userId] as const,
};

export function PatternsView() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const patternsQuery = useQuery({
    queryKey: patternsKeys.list(userId ?? ''),
    queryFn: () => listActivePatterns(userId!),
    enabled: !!userId,
  });

  const patterns = patternsQuery.data ?? [];
  const loading = patternsQuery.isLoading;

  if (!userId) return null;

  const runDetection = async () => {
    setRunning(true);
    try {
      await triggerPatternDetection(userId);
      await queryClient.invalidateQueries({ queryKey: patternsKeys.list(userId) });
    } catch (e: unknown) {
      notify('Wystąpił błąd podczas uruchamiania detekcji wzorców.', 'error');
      console.warn('[PatternsView] Failed to run pattern detection:', e);
    } finally {
      setRunning(false);
    }
  };

  const handleFeedback = (id: string, feedback: string) => {
    queryClient.setQueryData<PatternData[]>(patternsKeys.list(userId), (prev) =>
      (prev ?? []).map(p => p.id === id
        ? { ...p, status: feedback === 'confirmed' ? 'user_confirmed' : feedback === 'rejected' ? 'user_rejected' : p.status }
        : p
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          Wykryte wzorce
        </h2>
        <button
          onClick={() => void runDetection()}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Analizuję...' : 'Wykryj wzorce'}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-text-muted animate-pulse">Ładowanie wzorców...</div>
      ) : patterns.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">Brak wykrytych wzorców.</div>
      ) : (
        <div className="space-y-3">
          {patterns.map((p) => (
            <PatternCard key={p.id} pattern={p} onFeedback={handleFeedback} />
          ))}
        </div>
      )}
    </div>
  );
}
