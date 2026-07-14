import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

export type PageTemplateKind = 'list' | 'grid' | 'dashboard' | 'timeline';

export interface PageTemplateBoundaryProps {
  kind: PageTemplateKind;
  children: ReactNode;
}

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const reducedTransition = { duration: 0.2 };

const kindVariants = {
  list: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  timeline: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  dashboard: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  grid: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
} as const;

const spring = { type: 'spring' as const, damping: 1, duration: 0.35 };

/** Route-level design contract. `display: contents` preserves existing layout while
 * every descendant inherits the selected template's density and geometry tokens.
 * Wrapped in motion.div for spatial page transitions. */
export function PageTemplateBoundary({ kind, children }: PageTemplateBoundaryProps) {
  const v = kindVariants[kind];

  return (
    <motion.div
      className={`contents page-template-${kind}`}
      data-page-template={kind}
      variants={v}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={prefersReduced ? reducedTransition : spring}
    >
      {children}
    </motion.div>
  );
}

export default PageTemplateBoundary;
