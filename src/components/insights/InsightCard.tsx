import { useRef, useState } from 'react';
import { Pin, SortAsc, Trash2, X, Loader2 } from 'lucide-react';
import { CardFactory, type CardTemplateId } from '../cards/CardFactory';

export interface InsightCardData {
  id: string;
  templateId: string;
  title: string;
  insight?: string;
  widgetData: Record<string, unknown>;
  isPinned: boolean;
  sortOrder: number;
}

interface InsightCardProps {
  card: InsightCardData;
  onPin?: (id: string) => void;
  onSort?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

export function InsightCard({ card, onPin, onSort, onDelete }: InsightCardProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = () => {
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
            <Pin size={9} style={{ color: '#5B6CFF' }} />
            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#5B6CFF' }}>Przypięte</span>
          </div>
        )}
        <CardFactory
          templateId={card.templateId as CardTemplateId}
          data={card.widgetData}
          title={card.title}
        />
        {card.insight && (
          <p className="mt-1.5 px-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{card.insight}</p>
        )}
      </div>

      {/* Long-press overlay */}
      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-12"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOverlayOpen(false)}
        >
          <div className="flex gap-5 items-center" onClick={e => e.stopPropagation()}>
            {onSort && (
              <button
                onClick={() => { onSort(card.id); setOverlayOpen(false); }}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: '#F59E0B', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}
              >
                <SortAsc size={20} color="white" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: '#F43F5E', boxShadow: '0 0 20px rgba(244,63,94,0.4)' }}
              >
                {deleting ? <Loader2 size={20} color="white" className="animate-spin" /> : <Trash2 size={20} color="white" />}
              </button>
            )}
            <button
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
