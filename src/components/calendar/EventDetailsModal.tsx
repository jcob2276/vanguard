import React from 'react';
import { CalendarDays, Clock, MapPin, AlignLeft, Bell, Repeat, Edit3, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { CalRow } from './calendarHelpers';
import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import { monthLabel } from './calendarHelpers';

interface EventDetailsModalProps {
  event: CalRow | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatEventTime(startTime?: string | null, endTime?: string | null, isAllDay?: boolean | null): string {
  if (isAllDay) return 'Wydarzenie całodniowe';
  if (!startTime) return 'Brak godziny';
  const startPart = startTime.split('T')[1]?.slice(0, 5) || '';
  const endPart = endTime ? endTime.split('T')[1]?.slice(0, 5) || '' : '';
  if (startPart && endPart) return `${startPart} – ${endPart}`;
  return startPart;
}

export function EventDetailsModal({ event, onClose, onEdit, onDelete }: EventDetailsModalProps) {
  if (!event) return null;

  const sphere = LIFE_SPHERES.find((s) => s.id === event.category?.toLowerCase());
  const dateStr = event.start_time ? event.start_time.split('T')[0] : '';
  const formattedDate = dateStr ? monthLabel(dateStr) : '';
  const timeFormatted = formatEventTime(event.start_time, event.end_time, event.is_all_day);

  return (
    <Modal isOpen={Boolean(event)} onClose={onClose} title="Szczegóły wydarzenia" size="md">
      <div className="space-y-4">
        {/* Category & Title */}
        <div className="space-y-2">
          {sphere ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-solid border border-border-custom/40 text-xs font-bold text-text-primary">
              <span className={`w-2 h-2 rounded-full ${sphere.dot}`} />
              <span>{sphere.label}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-solid border border-border-custom/40 text-xs font-bold text-text-muted">
              <span className="w-2 h-2 rounded-full bg-text-muted/40" />
              <span>Brak kategorii</span>
            </div>
          )}

          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            {event.summary || 'Bez tytułu'}
          </h2>
        </div>

        {/* Date & Time Row */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-solid/30 border border-border-custom/30 text-xs font-semibold text-text-primary">
          <CalendarDays size={16} className="text-primary shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold">{formattedDate}</p>
            <p className="text-text-muted flex items-center gap-1">
              <Clock size={12} />
              {timeFormatted}
            </p>
          </div>
        </div>

        {/* Location Row */}
        {event.location ? (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-solid/30 border border-border-custom/30 text-xs font-medium text-text-primary">
            <MapPin size={16} className="text-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text-muted text-2xs uppercase tracking-wider mb-0.5">Lokalizacja</p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-bold text-primary"
              >
                {event.location}
              </a>
            </div>
          </div>
        ) : null}

        {/* Notes / Description */}
        {event.description ? (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-solid/30 border border-border-custom/30 text-xs text-text-primary">
            <AlignLeft size={16} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-text-muted text-2xs uppercase tracking-wider mb-0.5">Notatka</p>
              <p className="whitespace-pre-wrap text-text-secondary">{event.description}</p>
            </div>
          </div>
        ) : null}

        {/* Reminder */}
        {event.reminder_minutes ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-solid/20 border border-border-custom/20 text-xs font-semibold text-text-secondary">
            <Bell size={14} className="text-warning shrink-0" />
            <span>Przypomnienie: {event.reminder_minutes} minut przed</span>
          </div>
        ) : null}

        {/* Recurrence */}
        {event.recurrence && event.recurrence.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-solid/20 border border-border-custom/20 text-xs font-semibold text-text-secondary">
            <Repeat size={14} className="text-primary shrink-0" />
            <span>Powtarzalne: {event.recurrence.join(', ')}</span>
          </div>
        ) : null}

        {/* Actions Row */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onDelete}
            icon={<Trash2 size={16} />}
            className="h-11 border-danger/30 text-danger hover:bg-danger/10"
          >
            Usuń
          </Button>
          <Button
            variant="primary"
            onClick={onEdit}
            icon={<Edit3 size={16} />}
            className="h-11 flex-1 font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            Edytuj
          </Button>
        </div>
      </div>
    </Modal>
  );
}
