import { Pressable } from '../ui/ControlPrimitives';
import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import {
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
} from '../ui/sidebar';

export interface SidebarSubItemData {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarSectionItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  actions?: ReactNode;
  editing?: ReactNode;
  colorDot?: string;
  subItems?: SidebarSubItemData[];
}

export interface SidebarSectionProps {
  label?: string;
  items: SidebarSectionItem[];
  emptyLabel?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  onAdd?: () => void;
  addTitle?: string;
  trailingAdd?: ReactNode;
  bordered?: boolean;
  isLoading?: boolean;
  className?: string;
}

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
  isLoading = false,
  className = '',
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showItems = !collapsible || open;

  let isCollapsedIcon = false;
  try {
    const sidebar = useSidebar();
    isCollapsedIcon = sidebar.state === 'collapsed' && sidebar.collapsible === 'icon';
  } catch {
    // Outside SidebarProvider fallback
  }

  if (isLoading) {
    return (
      <div className={`flex flex-col gap-1 ${bordered ? 'border-t border-border-custom/30 pt-2' : ''} ${className}`}>
        {label && <div className="h-4 w-20 bg-surface-3 rounded animate-pulse my-1 mx-2" />}
        <SidebarMenuSkeleton />
        <SidebarMenuSkeleton />
        <SidebarMenuSkeleton />
      </div>
    );
  }

  if (isCollapsedIcon) {
    return (
      <div className={`flex flex-col items-center gap-1.5 ${bordered ? 'border-t border-border-custom/30 pt-2' : ''} ${className}`}>
        {items.map((item) => {
          const titleText = typeof item.label === 'string' ? item.label : undefined;
          return (
            <div key={item.id} className="relative flex items-center justify-center">
              <Pressable
                onClick={item.onClick}
                title={titleText}
                aria-label={titleText}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  item.active
                    ? 'bg-primary/15 text-primary font-bold shadow-xs'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                {item.colorDot ? (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.colorDot }} />
                ) : (
                  item.icon || <span className="h-2 w-2 rounded-full bg-text-muted" />
                )}
                {!!item.count && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white shadow-xs">
                    {item.count}
                  </span>
                )}
              </Pressable>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${bordered ? 'border-t border-border-custom/30 pt-2' : ''} ${className}`}>
      {(label || onAdd) &&
        (collapsible ? (
          <Pressable
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors font-display"
          >
            <ChevronDown size={11} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
            {label}
            {onAdd && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="ml-auto p-0.5 text-text-muted/60 hover:text-primary transition-colors"
                title={addTitle}
              >
                <Plus size={12} />
              </span>
            )}
          </Pressable>
        ) : (
          <div className="flex items-center justify-between px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted font-display">
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
        ))}

      {showItems && (
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col">
              <div className="group/sec relative flex items-center">
                {item.editing ? (
                  item.editing
                ) : (
                  <>
                    <Pressable
                      onClick={item.onClick}
                      className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm font-medium font-display transition-colors ${
                        item.active
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-text-secondary hover:bg-surface-solid/50 hover:text-text-primary'
                      }`}
                    >
                      {item.colorDot && (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.colorDot }} />
                      )}
                      {item.icon && <span className={item.active ? 'text-primary' : 'text-text-muted/90'}>{item.icon}</span>}
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {!!item.count && <span className="text-xs font-semibold text-text-muted/80 tabular-nums">{item.count}</span>}
                    </Pressable>
                    {item.actions && (
                      <div className="absolute right-1 hidden items-center gap-0.5 group-hover/sec:flex bg-surface/20">
                        {item.actions}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Nested Submenu support */}
              {item.subItems && item.subItems.length > 0 && (
                <SidebarMenuSub>
                  {item.subItems.map((sub) => (
                    <SidebarMenuSubItem key={sub.id}>
                      <SidebarMenuSubButton isActive={sub.active} icon={sub.icon} onClick={sub.onClick}>
                        {sub.label}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
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
