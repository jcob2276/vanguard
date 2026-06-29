import { useEffect, useRef } from 'react';
import { onGoalSpineInvalidated } from '../lib/goalSpine';

/** Stable spine-cache invalidation subscription — reload ref avoids re-subscribe loops. */
export function useGoalSpineInvalidation(reload: () => void | Promise<void>) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => onGoalSpineInvalidated(() => { void reloadRef.current(); }), []);
}
