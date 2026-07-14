import { Pressable } from '../ui/ControlPrimitives';
import type { ReactNode, RefObject } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import Input from '../ui/Input';
import PageToolbar from './PageToolbar';

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  leading?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
}

export function WorkspaceHeader({ title, subtitle, onBack, leading, center, actions, navigation }: WorkspaceHeaderProps) {
  return (
    <PageToolbar
      title={title}
      description={subtitle}
      leading={
        <>
      <Pressable variant="ghost" size="sm" onClick={onBack} className="shrink-0" aria-label="WrĂłÄ‡">
        <ChevronLeft size={20} strokeWidth={2.5} />
      </Pressable>
      {leading}
        </>
      }
      center={center}
      actions={actions}
      navigation={navigation}
    />
  );
}

interface WorkspaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

export function WorkspaceSearch({ value, onChange, placeholder, inputRef, className = '' }: WorkspaceSearchProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[var(--content-narrow)] ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/60" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-[var(--radius-full)] border-transparent bg-surface-2 pl-9 pr-9 text-sm font-medium hover:bg-surface-3 focus:border-primary/20 focus:bg-surface-tonal"
      />
      {value && (
        <Pressable
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full p-0 text-text-muted"
          aria-label="WyczyĹ›Ä‡ wyszukiwanie"
        >
          <X size={13} />
        </Pressable>
      )}
    </div>
  );
}
