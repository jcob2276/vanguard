import React from 'react';
import { useCalendarData } from './hooks/useCalendarData';

import DeleteEventConfirmModal from './DeleteEventConfirmModal';
import { QuickCreateEventModal } from './QuickCreateEventModal';
import { EditEventModal } from './EditEventModal';

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
  const { selectedEvent, showDeleteConfirm, setShowDeleteConfirm, deleting, executeDelete } = calData;

  return (
    <>
      <QuickCreateEventModal calData={calData} handleQuickSave={handleQuickSave} />
      <EditEventModal calData={calData} handleEditSave={handleEditSave} />
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
