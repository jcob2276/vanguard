import { ControlInput } from '../ui/ControlPrimitives';
import React from 'react';
import { TODO_NLP_HIGHLIGHT_REGEX } from '../../lib/todo/todoParser';

interface NlpHighlightInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function NlpHighlightInput({
  id,
  value,
  onChange,
  placeholder,
  className = '',
  onKeyDown,
  onFocus,
  onBlur,
}: NlpHighlightInputProps) {
  const segments = value.split(TODO_NLP_HIGHLIGHT_REGEX);

  return (
    <div className="relative w-full flex items-center">
      {/* Background Highlight layer */}
      <div
        className={`absolute inset-0 pointer-events-none select-none z-[var(--z-base)] whitespace-nowrap overflow-hidden flex items-center text-transparent ${className}`}
        style={{ color: 'transparent' }}
      >
        {segments.map((seg, idx) => {
          const isMatch = idx % 2 === 1;
          if (isMatch) {
            return (
              <span key={idx} className="bg-primary/20 text-transparent border border-primary/30 rounded px-1 py-0.25 mx-0.5 font-bold">
                {seg}
              </span>
            );
          }
          return <span key={idx}>{seg}</span>;
        })}
      </div>

      {/* Foreground Input layer */}
      <ControlInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`w-full bg-transparent relative z-[var(--z-raised)] outline-none ${className}`}
      />
    </div>
  );
}
