import { ReactNode, CSSProperties, ElementType, ComponentPropsWithoutRef } from 'react';

export type CardVariant = 'surface' | 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline' | 'notice' | 'danger' | 'accent';

type CardOwnProps = {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  padding?: string;
  as?: ElementType;
};

/** Extra DOM props pass through untouched */
type CardProps = CardOwnProps & Omit<ComponentPropsWithoutRef<'div'>, keyof CardOwnProps>;

const DOT_GRID_SVG = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%230A0A0A' fill-opacity='0.15'/%3E%3C/svg%3E")`;

const BASE = 'relative overflow-hidden transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-[20px]';

const VARIANTS: Record<CardVariant, { style: CSSProperties; className: string }> = {
  surface: {
    className: `${BASE} border border-black/8 dark:border-white/10 bg-surface-1 shadow-sm`,
    style: {},
  },
  glass: {
    className: `${BASE} border border-black/10 dark:border-white/12 bg-surface-1/80 dark:bg-surface-1/70 backdrop-blur-xl shadow-md`,
    style: {},
  },
  immersive: {
    className: `${BASE} border border-black/10 dark:border-white/10 bg-surface-2 dark:bg-zinc-950 shadow-xl`,
    style: {},
  },
  canvas: {
    className: `${BASE} bg-bg-secondary border border-black/8 dark:border-white/8`,
    style: {
      backgroundImage: DOT_GRID_SVG,
      backgroundSize: '20px 20px',
    },
  },
  receipt: {
    className: `${BASE} bg-bg-secondary border border-black/8 dark:border-white/10`,
    style: {},
  },
  outline: {
    className: `${BASE} bg-transparent border border-black/12 dark:border-white/15`,
    style: {},
  },
  notice: {
    className: `${BASE} bg-warning/10 border border-warning/25 text-warning-foreground`,
    style: {},
  },
  danger: {
    className: `${BASE} bg-danger/10 border border-danger/30 text-danger-foreground`,
    style: {},
  },
  accent: {
    className: `${BASE} bg-primary/10 border border-primary/20 text-primary-foreground`,
    style: {},
  },
};


export function Card({ variant = 'surface', children, className = '', style, onClick, padding, as: Tag = 'div' }: CardProps) {
  const v = VARIANTS[variant];
  return (
    <Tag
      className={`${v.className} ${onClick ? 'cursor-pointer active:scale-[0.97] touch-manipulation' : ''} ${className}`}
      style={{ padding: padding ?? '1rem', ...v.style, ...style }}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}

