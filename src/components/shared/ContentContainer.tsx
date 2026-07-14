import type { ElementType, ReactNode } from 'react';

export interface ContentContainerProps {
  children: ReactNode;
  width?: 'narrow' | 'default' | 'wide' | 'full';
  className?: string;
  as?: ElementType;
}

const WIDTHS = {
  narrow: 'max-w-[var(--content-narrow)]',
  default: 'max-w-[var(--content-default)]',
  wide: 'max-w-[var(--content-wide)]',
  full: 'max-w-none',
} as const;

export function ContentContainer({ children, width = 'default', className = '', as: Tag = 'div' }: ContentContainerProps) {
  return <Tag className={`mx-auto w-full px-[var(--space-4)] py-[var(--space-6)] md:px-[var(--space-8)] ${WIDTHS[width]} ${className}`}>{children}</Tag>;
}

export default ContentContainer;
