import { useCallback, useEffect, useState } from 'react';
import { useDirectionContext } from './useDirectionContext';

/** Checkpoint list backed by shared direction context */
export function useUpcomingCheckpoints(userId: string | undefined, horizonDays = 14) {
  const ctx = useDirectionContext(userId);
  const [items, setItems] = useState(ctx.checkpoints.all);

  useEffect(() => {
    const all = ctx.checkpoints.all;
    setItems(horizonDays >= 14 ? all : all.filter((cp) => cp.daysLeft <= horizonDays || cp.isOverdue));
  }, [ctx.checkpoints, horizonDays]);

  const overdue = items.filter((cp) => cp.isOverdue);
  const upcoming = items.filter((cp) => !cp.isOverdue);

  const reload = useCallback(async () => {
    await ctx.reload();
  }, [ctx]);

  return { items, overdue, upcoming, loading: ctx.loading, reload };
}
