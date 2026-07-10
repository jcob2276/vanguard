import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
}

const sizeClasses = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
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

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${sizeClasses[size]} rounded-[28px] border border-border-custom bg-surface shadow-xl p-5 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto`}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {subtitle && (
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1 leading-none">
                  {subtitle}
                </p>
              )}
              {title && (
                <h3 className="text-[17px] font-black text-text-primary leading-tight">
                  {title}
                </h3>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/50 transition-all cursor-pointer flex-shrink-0"
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="outline-none">{children}</div>
      </div>
    </div>
  );
}
