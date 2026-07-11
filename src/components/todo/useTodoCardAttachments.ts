import { useState, useEffect, useRef } from 'react';
import { notify } from '../../lib/notify';
import { listAttachments, uploadAttachment, deleteAttachment } from '../../lib/todo/todo';

export function useTodoCardAttachments(expanded: boolean, itemId: string, userId: string) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!expanded || attachmentsLoaded) return;
    listAttachments(itemId).then((rows) => {
      setAttachments(rows);
      setAttachmentsLoaded(true);
    }).catch(() => setAttachmentsLoaded(true));
  }, [expanded, itemId, attachmentsLoaded]);

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const created = await uploadAttachment(userId, itemId, file);
      setAttachments((prev) => [...prev, created]);
    } catch (e: unknown) { notify('Nie udało się wgrać załącznika.', 'error'); console.warn('[TodoCard] Failed to upload attachment:', e); } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (att: any) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    try { await deleteAttachment(att); } catch (e: unknown) { notify('Nie udało się usunąć załącznika.', 'error'); console.warn('[TodoCard] Failed to delete attachment:', e); }
  };

  return { attachments, attachmentsLoaded, uploadingFile, fileInputRef, handleFileUpload, handleDeleteAttachment };
}
