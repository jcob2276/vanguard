import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import Button, { type ButtonProps } from './Button';

const CONTROL_MOTION = 'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]';

/** Semantic low-level interaction target for complex widgets.
 * Use Button for ordinary actions; Pressable exists for calendars, cards and drag handles. */
export type PressableProps = ButtonHTMLAttributes<HTMLButtonElement> & Partial<Pick<ButtonProps, 'variant' | 'size' | 'loading' | 'icon' | 'iconPosition'>>;

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  ({ className = '', type = 'button', variant, size, loading, icon, iconPosition, ...props }, ref) => {
    const usesButtonContract = variant !== undefined || size !== undefined || loading !== undefined || icon !== undefined || iconPosition !== undefined;
    if (usesButtonContract) {
      return <Button ref={ref} type={type} variant={variant} size={size} loading={loading} icon={icon} iconPosition={iconPosition} className={className} {...props} />;
    }
    return <button ref={ref} type={type} data-ui="pressable" className={`${CONTROL_MOTION} active:scale-97 cursor-pointer ${className}`} {...props} />;
  },
);
Pressable.displayName = 'Pressable';

export const ControlInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} data-ui="control-input" className={`${CONTROL_MOTION} font-inherit text-inherit outline-none focus-visible:shadow-focus ${className}`} {...props} />
  ),
);
ControlInput.displayName = 'ControlInput';

export const ControlSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => (
    <select ref={ref} data-ui="control-select" className={`${CONTROL_MOTION} font-inherit text-inherit outline-none focus-visible:shadow-focus ${className}`} {...props} />
  ),
);
ControlSelect.displayName = 'ControlSelect';

export const ControlTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} data-ui="control-textarea" className={`${CONTROL_MOTION} font-inherit text-inherit outline-none focus-visible:shadow-focus ${className}`} {...props} />
  ),
);
ControlTextarea.displayName = 'ControlTextarea';
