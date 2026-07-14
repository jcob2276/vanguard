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
            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>Przypięte</span>
          </div>
        )}
        {!widgetType && card.title && expanded && (
          <p className="text-[15px] font-bold text-text-primary mb-2">{card.title}</p>
        )}
        {body}
        {card.insight && (
          <p className="mt-1.5 px-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{card.insight}</p>
        )}
      </div>

      {overlayOpen && (
        // NOTE: custom overlay — InsightCard shows a long-press mobile context menu with circular action
        // buttons anchored at the bottom-center. ui/Modal shows a dialog box and cannot render these
        // floating radial buttons, so a raw fixed overlay is intentional here.
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-12"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOverlayOpen(false)}
        >
          <div className="flex gap-5 items-center" onClick={e => e.stopPropagation()}>
            {onPin && (
              <button
                type="button"
                onClick={() => { onPin(card.id); setOverlayOpen(false); }}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'var(--color-primary)', boxShadow: '0 0 20px rgba(91,108,255,0.4)' }}
              >
                <Pin size={20} color="white" />
              </button>
            )}
            {onSort && (
              <button
                type="button"
                onClick={() => { onSort(card.id); setOverlayOpen(false); }}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'var(--color-warning)', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}
              >
                <SortAsc size={20} color="white" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'var(--color-danger)', boxShadow: '0 0 20px rgba(244,63,94,0.4)' }}
              >
                {deleting ? <Spinner size="sm" className="h-5 w-5 !border-white/30 !border-t-white" /> : <Trash2 size={20} color="white" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'white' }}
            >
              <X size={16} color="#0A0A0A" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
