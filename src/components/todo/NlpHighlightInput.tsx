import { ControlInput } from '../ui/ControlPrimitives';
import React from 'react';

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
  // Regex matches: p1-p4, relative dates, days of week, recurrence keywords, times (e.g. o 22, 22:00), and numeric dates (e.g. 12.05)
  const nlpRegex = /\b(p[1-4]|dzisiaj|dzis|dziś|jutro|pojutrze|poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela|poniedzialek|sroda|piatek|pon|wt|śr|sr|czw|pt|sob|nd|niedz|codziennie|co\s+dzień|co\s+dzien|co\s+tydzień|co\s+tydzien|co\s+miesiąc|co\s+miesiac|o\s+\d{1,2}(?:[:.]\d{2})?|\d{1,2}:\d{2}|\d{1,2}[./-]\d{1,2})\b/gi;

  const segments = value.split(nlpRegex);

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
