import { Pressable } from '../ui/ControlPrimitives';
import type { ReactNode, RefObject } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import Input from '../ui/Input';
import PageToolbar from './PageToolbar';
import Tabs from '../ui/Tabs';

interface WorkspaceHeaderTab { key: string; label: string; icon?: ReactNode }

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  leading?: ReactNode;
  /** Escape hatch for a fully custom center slot. Prefer `search` below when it's just a search box. */
  center?: ReactNode;
  /** Renders a WorkspaceSearch in the center slot — replaces hand-wiring it per module. */
  search?: { value: string; onChange: (value: string) => void; placeholder: string; inputRef?: RefObject<HTMLInputElement | null> };
  actions?: ReactNode;
  /** Renders a Tabs bar in the navigation slot — replaces hand-wiring <Tabs> per module. */
  tabs?: { items: WorkspaceHeaderTab[]; active: string; onChange: (key: string) => void };
  navigation?: ReactNode;
  /** Extra row below the header (e.g. Links' inline "add URL" expand form). */
  secondaryRow?: ReactNode;
}

export function WorkspaceHeader({ title, subtitle, onBack, leading, center, search, actions, tabs, navigation, secondaryRow }: WorkspaceHeaderProps) {
  return (
    <>
      <PageToolbar
        title={title}
        description={subtitle}
        leading={
          <>
        <Pressable variant="ghost" size="sm" onClick={onBack} className="shrink-0" aria-label="Wróć">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </Pressable>
        {leading}
          </>
        }
        center={search ? <WorkspaceSearch {...search} /> : center}
        actions={actions}
        navigation={tabs ? <Tabs tabs={tabs.items} active={tabs.active} onChange={tabs.onChange} /> : navigation}
      />
      {secondaryRow}
    </>
  );
}

interface WorkspaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

function WorkspaceSearch({ value, onChange, placeholder, inputRef, className = '' }: WorkspaceSearchProps) {
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
          aria-label="Wyczyść wyszukiwanie"
        >
          <X size={13} />
        </Pressable>
      )}
    </div>
  );
}
