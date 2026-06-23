import { ReactNode, CSSProperties } from 'react';

export type CardVariant = 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline';

interface CardProps {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  padding?: string;
}

const DOT_GRID_SVG = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%230A0A0A' fill-opacity='0.15'/%3E%3C/svg%3E")`;

const BASE = 'relative overflow-hidden transition-all duration-200';

const VARIANTS: Record<CardVariant, { style: CSSProperties; className: string }> = {
  glass: {
    className: `${BASE} bg-white`,
    style: {
      borderRadius: 20,
      boxShadow: 'var(--shadow-card)',
    },
  },
  immersive: {
    className: `${BASE}`,
    style: {
      background: '#0A0A0A',
      borderRadius: 24,
      boxShadow: 'var(--shadow-float)',
    },
  },
  canvas: {
    className: `${BASE} bg-white`,
    style: {
      borderRadius: 20,
      boxShadow: 'var(--shadow-card)',
      backgroundImage: DOT_GRID_SVG,
      backgroundSize: '20px 20px',
    },
  },
  receipt: {
    className: `${BASE} bg-white`,
    style: {
      borderRadius: 24,
      border: '1px solid rgba(153,161,175,0.2)',
    },
  },
  outline: {
    className: `${BASE} bg-transparent`,
    style: {
      borderRadius: 24,
      border: '1px solid rgba(153,161,175,0.3)',
    },
  },
};

export function Card({ variant = 'glass', children, className = '', style, onClick, padding }: CardProps) {
  const v = VARIANTS[variant];
  return (
    <div
      className={`${v.className} ${onClick ? 'cursor-pointer active:scale-[0.985]' : ''} ${className}`}
      style={{ padding: padding ?? '1rem', ...v.style, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
