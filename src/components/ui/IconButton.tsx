import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Button from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tonal';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = 'md', variant = 'ghost', className = '', ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={`aspect-square !min-w-0 !px-0 ${className}`}
      aria-label={label}
      title={props.title ?? label}
      {...props}
    >
      {icon}
    </Button>
  ),
);

IconButton.displayName = 'IconButton';

export default IconButton;
