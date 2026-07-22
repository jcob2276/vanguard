import React from 'react';
import { useCalendarData } from './hooks/useCalendarData';

import DeleteEventConfirmModal from './DeleteEventConfirmModal';
import { QuickCreateEventModal } from './QuickCreateEventModal';
import { EditEventModal } from './EditEventModal';
import { EventDetailsModal } from './EventDetailsModal';

interface CalendarEventModalProps {
  calData: ReturnType<typeof useCalendarData>;
  handleQuickSave: () => void;
  handleEditSave: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  calData,
  handleQuickSave,
  handleEditSave,
}) => {
  const {
    viewingEvent,
    setViewingEvent,
    openEditFromPreview,
    selectedEvent,
    setSelectedEvent,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleting,
    executeDelete,
  } = calData;

  return (
    <>
      <QuickCreateEventModal calData={calData} handleQuickSave={handleQuickSave} />
      <EditEventModal calData={calData} handleEditSave={handleEditSave} />
      <EventDetailsModal
        event={viewingEvent}
        onClose={() => setViewingEvent(null)}
        onEdit={() => viewingEvent && openEditFromPreview(viewingEvent)}
        onDelete={() => {
          if (viewingEvent) {
            setSelectedEvent(viewingEvent);
            setViewingEvent(null);
            setShowDeleteConfirm(true);
          }
        }}
      />
      {showDeleteConfirm && (
        <DeleteEventConfirmModal
          selectedEvent={selectedEvent}
          deleting={deleting}
          onClose={() => setShowDeleteConfirm(false)}
          executeDelete={executeDelete}
        />
      )}
    </>
  );
};
