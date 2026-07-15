import { Pressable } from '../ui/ControlPrimitives';
import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface SidebarSectionItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  active?: boolean;
  onClick: () => void;
  /** Hover-revealed row actions (rename/delete icon buttons). */
  actions?: ReactNode;
  /** Replaces the row's label/actions with an inline edit control (e.g. rename input). */
  editing?: ReactNode;
  colorDot?: string;
}

export interface SidebarSectionProps {
  label?: string;
  items: SidebarSectionItem[];
  emptyLabel?: string;
  /** Collapsible header (chevron toggle) — used by Todo's "Moje projekty". Omit for flat sections. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** "+" button next to the section label (e.g. add tag/list). */
  onAdd?: () => void;
  addTitle?: string;
  /** Extra row rendered after items (e.g. Todo's inline "add list" input/button). */
  trailingAdd?: ReactNode;
  /** Adds a top border + padding, matching the divider used between sidebar blocks. */
  bordered?: boolean;
  className?: string;
}

/**
 * One reusable "recipe" for a sidebar nav block: an optional label row (with
 * add button / collapse toggle) followed by a list of items with icon, count,
 * active state, and hover-revealed actions. Covers Todo's "Moje projekty",
 * Keep's "Notatki"/"Tagi", and Links' "Kategorie" — the three item-list
 * patterns that were previously hand-rolled per module.
 */
export default function SidebarSection({
  label,
  items,
  emptyLabel,
  collapsible = false,
  defaultOpen = true,
  onAdd,
  addTitle = 'Dodaj',
  trailingAdd,
  bordered = false,
  className = '',
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showItems = !collapsible || open;

  return (
    <div className={`flex flex-col gap-0.5 ${bordered ? 'border-t border-border-custom/30 pt-2' : ''} ${className}`}>
      {(label || onAdd) && (
        collapsible ? (
          <Pressable
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted/60 hover:text-text-primary transition-colors"
          >
            <ChevronDown size={11} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
            {label}
            {onAdd && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="ml-auto p-0.5 text-text-muted/40 hover:text-primary transition-colors"
                title={addTitle}
              >
                <Plus size={12} />
              </span>
            )}
          </Pressable>
        ) : (
          <div className="flex items-center justify-between px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted/60">
            <span>{label}</span>
            {onAdd && (
              <Pressable
                onClick={onAdd}
                className="p-1 rounded hover:bg-surface-2 hover:text-text-primary transition-colors"
                title={addTitle}
              >
                <Plus size={13} />
              </Pressable>
            )}
          </div>
        )
      )}

      {showItems && (
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="group/sec relative flex items-center">
              {item.editing ? (
                item.editing
              ) : (
                <>
                  <Pressable
                    onClick={item.onClick}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                      item.active ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-solid/50 hover:text-text-primary'
                    }`}
                  >
                    {item.colorDot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.colorDot }} />}
                    {item.icon && <span className={item.active ? 'text-primary' : 'text-text-muted/60'}>{item.icon}</span>}
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    {!!item.count && <span className="text-xs font-semibold text-text-muted/50 tabular-nums">{item.count}</span>}
                  </Pressable>
                  {item.actions && (
                    <div className="absolute right-1 hidden items-center gap-0.5 group-hover/sec:flex bg-surface/20">
                      {item.actions}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {items.length === 0 && emptyLabel && (
            <p className="px-2.5 py-1.5 text-xs italic text-text-muted/40">{emptyLabel}</p>
          )}

          {trailingAdd}
        </div>
      )}
    </div>
  );
}
