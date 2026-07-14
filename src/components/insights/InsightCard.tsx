import Button from '../ui/Button';
import { useRef, useState } from 'react';
import { Pin, SortAsc, Trash2, X } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { CardFactory, type CardTemplateId } from '../cards/CardFactory';
import { WidgetFactory, type WidgetType } from '../widgets/WidgetFactory';
import type { InsightCardData } from '../../lib/insightsApi';

interface InsightCardProps {
  card: InsightCardData;
  onPin?: (id: string) => void;
  onSort?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  expanded?: boolean;
}

export function InsightCard({ card, onPin, onSort, onDelete, expanded }: InsightCardProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const widgetType =
    card.widgetType ||
    (typeof card.widgetData.widget_type === 'string' ? card.widgetData.widget_type : undefined);

  const startLongPress = () => {
    if (expanded) return;
    longPressTimer.current = setTimeout(() => setOverlayOpen(true), 550);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(card.id); } finally { setDeleting(false); setOverlayOpen(false); }
  };

  const body = widgetType ? (
    <WidgetFactory type={widgetType as WidgetType} data={card.widgetData} />
  ) : (
    <CardFactory
      templateId={card.templateId as CardTemplateId}
      data={card.widgetData}
      title={card.title}
    />
  );

  return (
    <div className="relative">
      <div
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        style={{ userSelect: 'none' }}
      >
        {card.isPinned && (
          <div className="flex items-center gap-1 mb-1.5 px-1">
            <Pin size={9} style={{ color: 'var(--color-primary)' }} />
            <span className="text-2xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>Przypięte</span>
          </div>
        )}
        {!widgetType && card.title && expanded && (
          <p className="text-base font-bold text-text-primary mb-2">{card.title}</p>
        )}
        {body}
        {card.insight && (
          <p className="mt-1.5 px-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{card.insight}</p>
        )}
      </div>

      {overlayOpen && (
        // NOTE: custom overlay — InsightCard shows a long-press mobile context menu with circular action
        // buttons anchored at the bottom-center. ui/Modal shows a dialog box and cannot render these
        // floating radial buttons, so a raw fixed overlay is intentional here.
        <div
          className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center pb-12"
          style={{ background: 'var(--legacy-color-055)' }}
          onClick={() => setOverlayOpen(false)}
        >
          <div className="flex gap-5 items-center" onClick={e => e.stopPropagation()}>
            {onPin && (
              <Button
                variant="ghost"
                onClick={() => { onPin(card.id); setOverlayOpen(false); }}
                icon={<Pin size={20} color="white" />}
                className="w-14 h-14 min-w-0 p-0 rounded-full shadow-lg hover:bg-transparent"
                style={{ background: 'var(--color-primary)', boxShadow: '0 0 20px var(--legacy-color-152)' }}
              />
            )}
            {onSort && (
              <Button
                variant="ghost"
                onClick={() => { onSort(card.id); setOverlayOpen(false); }}
                icon={<SortAsc size={20} color="white" />}
                className="w-14 h-14 min-w-0 p-0 rounded-full shadow-lg hover:bg-transparent"
                style={{ background: 'var(--color-warning)', boxShadow: '0 0 20px var(--legacy-color-123)' }}
              />
            )}
            {onDelete && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                icon={deleting ? <Spinner size="sm" className="h-5 w-5 !border-on-accent/30 !border-t-white" /> : <Trash2 size={20} color="white" />}
                className="w-14 h-14 min-w-0 p-0 rounded-full shadow-lg hover:bg-transparent"
                style={{ background: 'var(--color-danger)', boxShadow: '0 0 20px var(--legacy-color-116)' }}
              />
            )}
            <Button
              variant="ghost"
              onClick={() => setOverlayOpen(false)}
              icon={<X size={16} color="var(--legacy-color-002)" />}
              className="w-10 h-10 min-w-0 p-0 rounded-full hover:bg-transparent"
              style={{ background: 'white' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
