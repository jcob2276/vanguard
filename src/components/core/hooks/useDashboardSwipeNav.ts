import { useCallback, useRef } from 'react';

interface UseDashboardSwipeNavProps {
  view: string;
  navigateTo: (newView: string) => void;
  tabOrder: string[];
}

export function useDashboardSwipeNav({
  view,
  navigateTo,
  tabOrder,
}: UseDashboardSwipeNavProps) {
  const swipeStart = useRef<{ x: number; y: number; t: number; blocksNavigation: boolean } | null>(null);

  const handleMainTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const target = e.target as HTMLElement;
    swipeStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
      blocksNavigation: Boolean(target.closest('[data-no-swipe-nav]')),
    };
  }, []);

  const handleMainTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    if (start.blocksNavigation) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const deltaT = Date.now() - start.t;

    const isHorizontalEnough = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    const isFarEnough = Math.abs(deltaX) >= 45;
    const isFastEnough = deltaT < 1000;
    if (!isHorizontalEnough || !isFarEnough || !isFastEnough) return;

    const idx = tabOrder.indexOf(view);
    if (idx === -1) return;
    const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= tabOrder.length) return;
    navigateTo(tabOrder[nextIdx]);
  }, [view, navigateTo, tabOrder]);

  return { handleMainTouchStart, handleMainTouchEnd };
}
