import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  padding?: string;
  overflowY?: boolean;
  className?: string;
  overlayClassName?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const sizeClasses = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full m-4',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  padding = 'p-5',
  overflowY = true,
  className = '',
  overlayClassName = '',
  containerRef,
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === backdropRef.current) {
      onClose();
    }
  };

  const verticalAlignClass = overlayClassName.includes('items-') ? '' : 'items-end sm:items-center';
  const justifyClass = overlayClassName.includes('justify-') ? '' : 'justify-center';
  const flexDirClass = overlayClassName.includes('flex-col') ? 'flex-col' : '';
  const backdropPadding = overlayClassName.includes('p-0') ? '' : 'p-4';

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[var(--z-overlay)] flex bg-scrim/40 backdrop-blur-[var(--blur-sm)] animate-fadeIn ${backdropPadding} ${verticalAlignClass} ${justifyClass} ${flexDirClass} ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={containerRef}
        className={`w-full ${sizeClasses[size]} glass-floating rounded-[var(--radius-xl)] shadow-xl ${padding} ${overflowY ? 'max-h-[var(--ds-arbitrary-90vh)] overflow-y-auto' : ''} ${className}`}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {subtitle && (
                <p className="pixel-label mb-1 leading-none">
                  {subtitle}
                </p>
              )}
              {title && (
                <h3 className="text-lg font-black text-text-primary leading-tight">
                  {title}
                </h3>
              )}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 flex-shrink-0 rounded-full p-0 text-text-muted"
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <div className="outline-none">{children}</div>
      </div>
    </div>
  );
}
