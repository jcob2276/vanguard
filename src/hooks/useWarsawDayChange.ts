import { useEffect, useRef } from 'react';
import { getTodayWarsaw } from '../lib/date';

/** Re-run callback when Warsaw calendar date changes (midnight or tab return). */
export function useWarsawDayChange(onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let lastDate = getTodayWarsaw();
    const tick = () => {
      const today = getTodayWarsaw();
      if (today === lastDate) return;
      lastDate = today;
      onChangeRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);
}
