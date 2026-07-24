import { useEffect, useRef } from 'react';
import { useHaptics } from './useHaptics';
import { shouldCommitGesture } from '../lib/motion/iosMotion';

interface UseEdgeSwipeBackOptions {
  onBack: () => void;
  enabled?: boolean;
  edgeThresholdPx?: number;
}

/**
 * iOS-style edge swipe-to-back gesture hook.
 * Triggers when dragging from the left edge (x < 30px) towards the right.
 * Translates the container 1:1 and triggers `onBack()` on commit.
 */
export function useEdgeSwipeBack<T extends HTMLElement = HTMLDivElement>({
  onBack,
  enabled = true,
  edgeThresholdPx = 32,
}: UseEdgeSwipeBackOptions) {
  const containerRef = useRef<T | null>(null);
  const { selection } = useHaptics();

  const gestureState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    triggeredHaptic: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    triggeredHaptic: false,
  });

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Only initiate if grab starts near the left screen edge
      if (touch.clientX > edgeThresholdPx) return;

      gestureState.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: Date.now(),
        triggeredHaptic: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = gestureState.current;
      if (!state.active) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      // Ignore vertical scrolling
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && deltaX < 20) {
        state.active = false;
        el.style.transform = '';
        return;
      }

      if (deltaX > 0) {
        e.preventDefault();
        el.style.transition = 'none';
        el.style.transform = `translate3d(${deltaX}px, 0, 0)`;

        if (deltaX > 80 && !state.triggeredHaptic) {
          state.triggeredHaptic = true;
          selection();
        }
      }

      state.lastX = touch.clientX;
      state.lastTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = gestureState.current;
      if (!state.active) return;
      state.active = false;

      const touch = e.changedTouches[0];
      const deltaX = touch ? touch.clientX - state.startX : 0;
      const dt = Math.max(1, Date.now() - state.lastTime);
      const velocityX = touch ? ((touch.clientX - state.lastX) / dt) * 1000 : 0;

      const commits = shouldCommitGesture({
        distance: deltaX,
        velocity: velocityX,
        dimension: el.clientWidth || window.innerWidth,
        distanceRatio: 0.25,
        velocityThreshold: 450,
      });

      if (commits && deltaX > 0) {
        // Slide off screen to right and trigger onBack
        el.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = `translate3d(${window.innerWidth}px, 0, 0)`;
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.transform = '';
            containerRef.current.style.transition = '';
          }
          onBack();
        }, 180);
      } else {
        // Spring back to home
        el.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.transition = '';
          }
        }, 250);
      }
    };

    const handleTouchCancel = () => {
      gestureState.current.active = false;
      if (el) {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, edgeThresholdPx, onBack, selection]);

  return containerRef;
}
