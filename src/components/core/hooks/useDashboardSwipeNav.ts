import { useCallback, useRef } from 'react';
import { rubberBand, shouldCommitGesture } from '../../../lib/motion/iosMotion';

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
  const swipeStart = useRef<{
    x: number;
    y: number;
    t: number;
    lastX: number;
    lastT: number;
    blocksNavigation: boolean;
    axis?: 'x' | 'y';
  } | null>(null);

  const handleMainTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const target = e.target as HTMLElement;
    swipeStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
      lastX: touch.clientX,
      lastT: Date.now(),
      blocksNavigation: Boolean(target.closest('[data-no-swipe-nav]')),
    };
  }, []);

  const handleMainTouchMove = useCallback((e: React.TouchEvent<HTMLElement>) => {
    const start = swipeStart.current;
    const touch = e.touches[0];
    if (!start || !touch || start.blocksNavigation) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (!start.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 10) {
      start.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? 'x' : 'y';
    }
    if (start.axis !== 'x') return;

    const index = tabOrder.indexOf(view);
    const beyondEdge = (index === 0 && deltaX > 0) ||
      (index === tabOrder.length - 1 && deltaX < 0);
    const offset = beyondEdge ? rubberBand(deltaX, e.currentTarget.clientWidth) : deltaX;
    e.currentTarget.style.transform = `translate3d(${offset}px, 0, 0)`;
    e.currentTarget.style.transition = 'none';
    start.lastX = touch.clientX;
    start.lastT = Date.now();
  }, [tabOrder, view]);

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
    const velocitySampleTime = Math.max(1, Date.now() - start.lastT);
    const velocityX = ((touch.clientX - start.lastX) / velocitySampleTime) * 1_000;
    const element = e.currentTarget as HTMLElement;
    element.style.transition = 'transform var(--motion-medium) var(--ease-out)';
    element.style.transform = 'translate3d(0, 0, 0)';

    const isHorizontalEnough = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    const isFastEnough = deltaT < 1000;
    const commits = shouldCommitGesture({
      distance: deltaX,
      velocity: velocityX,
      dimension: element.clientWidth || window.innerWidth,
    });
    if (!isHorizontalEnough || !commits || !isFastEnough) return;

    const idx = tabOrder.indexOf(view);
    if (idx === -1) return;
    const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= tabOrder.length) return;
    navigateTo(tabOrder[nextIdx]);
  }, [view, navigateTo, tabOrder]);

  const handleMainTouchCancel = useCallback((e: React.TouchEvent<HTMLElement>) => {
    swipeStart.current = null;
    e.currentTarget.style.transition = 'transform var(--motion-medium) var(--ease-out)';
    e.currentTarget.style.transform = 'translate3d(0, 0, 0)';
  }, []);

  return {
    handleMainTouchStart,
    handleMainTouchMove,
    handleMainTouchEnd,
    handleMainTouchCancel,
  };
}
