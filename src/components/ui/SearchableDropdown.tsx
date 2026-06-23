import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SearchableDropdownProps<T = string> {
  options: DropdownOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
}

export function SearchableDropdown<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Wybierz...',
  searchPlaceholder = 'Szukaj...',
  label,
  disabled,
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.description?.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setHighlighted(0);
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) { onChange(filtered[highlighted].value); setOpen(false); } }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>}

      {/* Trigger */}
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all"
        style={{
          background: 'var(--surface-solid)',
          border: `1px solid ${open ? 'rgba(91,108,255,0.4)' : 'rgba(153,161,175,0.2)'}`,
          boxShadow: open ? '0 0 0 3px rgba(91,108,255,0.08)' : 'none',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {selected?.icon && <span className="flex-shrink-0">{selected.icon}</span>}
        <span className="flex-1 text-[13px]" style={{ color: selected ? 'var(--text-primary)' : 'var(--color-text-tertiary)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{ color: 'var(--color-text-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        />
      </button>

      {/* Overlay dropdown */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid rgba(153,161,175,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            maxHeight: 280,
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(153,161,175,0.1)' }}>
            <Search size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={handleKey}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-[12px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X size={11} style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            )}
          </div>

          {/* Options */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-center" style={{ color: 'var(--color-text-tertiary)' }}>Brak wyników</p>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={String(opt.value)}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: i === highlighted ? 'rgba(91,108,255,0.07)' : 'transparent',
                    borderLeft: opt.value === value ? '2px solid #5B6CFF' : '2px solid transparent',
                  }}
                >
                  {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{opt.label}</p>
                    {opt.description && <p className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{opt.description}</p>}
                  </div>
                  {opt.value === value && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#5B6CFF' }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
