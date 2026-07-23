import { useUserId } from '../../store/useStore';
import { useNoteAttachmentsController } from './hooks/useNoteAttachmentsController';
import NoteAttachmentsView from './NoteAttachmentsView';

export default function NoteAttachments({ noteId, onInsertText }: { noteId: string; onInsertText?: (text: string) => void }) {
  const userId = useUserId();
  const controller = useNoteAttachmentsController(noteId, userId || '');
  if (!userId) return null;
  return (
    <NoteAttachmentsView
      attachments={controller.attachments}
      loading={controller.isLoading}
      busy={controller.busy}
      onUpload={controller.uploadFiles}
      onScan={controller.uploadScan}
      onScanText={async file => {
        const text = await controller.scanText(file);
        onInsertText?.(text);
      }}
      onRecord={controller.recordAudio}
      onDelete={controller.removeAttachment}
    />
  );
}
