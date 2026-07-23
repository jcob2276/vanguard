import type { ReactNode } from 'react';

interface FullscreenExperienceProps {
  label: string;
  children: ReactNode;
  tone?: 'light' | 'dark' | 'success';
  className?: string;
}

const TONES = {
  light: 'ios-fullscreen-experience-light',
  dark: 'ios-fullscreen-experience-dark',
  success: 'ios-fullscreen-experience-success',
} as const;

export default function FullscreenExperience({
  label,
  children,
  tone = 'light',
  className = '',
}: FullscreenExperienceProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`ios-fullscreen-experience ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
