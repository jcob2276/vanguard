import React, { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';
import { IOS_SPRING } from '../../lib/motion/iosMotion';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!isOpen) {
      restoreFocusRef.current?.focus();
      return;
    }

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    (first ?? dialogRef.current)?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      restoreFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className={`fixed inset-0 z-[var(--z-overlay)] flex bg-scrim/40 backdrop-blur-[var(--blur-sm)] ${backdropPadding} ${verticalAlignClass} ${justifyClass} ${flexDirClass} ${overlayClassName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
        >
          <motion.div
            ref={(node) => {
              dialogRef.current = node;
              if (containerRef) containerRef.current = node;
            }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            className={`w-full ${sizeClasses[size]} glass-floating rounded-[var(--radius-xl)] shadow-xl ${padding} ${overflowY ? 'max-h-[var(--ds-arbitrary-90vh)] overflow-y-auto' : ''} ${className}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0.12 } : IOS_SPRING.default}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
