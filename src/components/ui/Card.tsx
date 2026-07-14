import { ReactNode, CSSProperties, ElementType, ComponentPropsWithoutRef } from 'react';

export type CardVariant = 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline' | 'notice' | 'danger' | 'accent';

type CardOwnProps = {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  padding?: string;
  as?: ElementType;
};

/** Extra DOM props (drag handlers, onMouseDown, etc.) pass through untouched — only
 *  the props above are given Card-specific meaning. */
type CardProps = CardOwnProps & Omit<ComponentPropsWithoutRef<'div'>, keyof CardOwnProps>;

const DOT_GRID_SVG = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%230A0A0A' fill-opacity='0.15'/%3E%3C/svg%3E")`;

const BASE = 'relative overflow-hidden transition-all duration-200';

const VARIANTS: Record<CardVariant, { style: CSSProperties; className: string }> = {
  glass: {
    className: `${BASE} bg-bg-secondary`,
    style: {
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
    },
  },
  immersive: {
    className: `${BASE}`,
    style: {
      background: '#0A0A0A',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-float)',
    },
  },
  canvas: {
    className: `${BASE} bg-bg-secondary`,
    style: {
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
      backgroundImage: DOT_GRID_SVG,
      backgroundSize: '20px 20px',
    },
  },
  receipt: {
    className: `${BASE} bg-bg-secondary`,
    style: {
      borderRadius: 'var(--radius-lg)',
      border: '1px solid rgba(153,161,175,0.2)',
    },
  },
  outline: {
    className: `${BASE} bg-transparent`,
    style: {
      borderRadius: 'var(--radius-lg)',
      border: '1px solid rgba(153,161,175,0.3)',
    },
  },
  notice: {
    className: `${BASE} bg-amber-500/[0.04] border border-amber-500/20`,
    style: {
      borderRadius: 'var(--radius-lg)',
    },
  },
  danger: {
    className: `${BASE} bg-danger/10 border border-danger/30`,
    style: {
      borderRadius: 'var(--radius-lg)',
    },
  },
  accent: {
    className: `${BASE} bg-primary/[0.02] border border-primary/10`,
    style: {
      borderRadius: 'var(--radius-lg)',
    },
  },
};

export function Card({ variant = 'glass', children, className = '', style, onClick, padding, as: Tag = 'div' }: CardProps) {
  const v = VARIANTS[variant];
  return (
    <Tag
      className={`${v.className} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
      style={{ padding: padding ?? '1rem', ...v.style, ...style }}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}
