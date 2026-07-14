import React from 'react';

export interface FabProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  position?: 'bottom-right' | 'bottom-center' | 'custom';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}

const positionClasses = {
  'bottom-right': 'fixed bottom-8 right-8 sm:bottom-6 sm:right-5 z-[var(--z-fullscreen)]',
  'bottom-center': 'fixed left-1/2 -translate-x-1/2 z-[var(--z-overlay)]',
  custom: '',
};

const sizeClasses = {
  sm: 'h-11 w-11',
  md: 'h-13 w-13 sm:h-12 sm:w-12',
  lg: 'h-14 w-14 sm:h-13 sm:w-13',
};

export default function Fab({
  onClick,
  position = 'bottom-right',
  size = 'md',
  children,
  className = '',
  style,
  disabled = false,
  title,
  type = 'button',
}: FabProps) {
  // scale-108 hover, scale-93 active for iOS physical feel (from keep-fab and design system)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center rounded-full bg-primary text-on-accent shadow-lg shadow-primary/25 transition-all duration-[var(--motion-medium)] active:scale-93 hover:scale-105 disabled:opacity-[var(--opacity-50)] disabled:pointer-events-none cursor-pointer ${positionClasses[position]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}
