import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  deleteNoteAttachment,
  recognizeNoteImage,
  transcribeNoteAudio,
  updateAttachmentTranscript,
  updateAttachmentOcr,
  uploadNoteAttachment,
  useNoteAttachments,
  type NoteAttachment,
} from '../../../lib/noteAttachmentsApi';
import { notify } from '../../../lib/notify';
import { notesKeys } from '../../../lib/queryKeys';

export function useNoteAttachmentsController(noteId: string, userId: string) {
  const queryClient = useQueryClient();
  const { data: attachments = [], isLoading } = useNoteAttachments(noteId);
  const [busy, setBusy] = useState(false);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) await uploadNoteAttachment(userId, noteId, file);
      await queryClient.invalidateQueries({ queryKey: notesKeys.attachments(noteId) });
      notify(files.length === 1 ? 'Dodano załącznik' : `Dodano ${files.length} załączników`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się dodać załącznika', 'error');
    } finally {
      setBusy(false);
    }
  }, [noteId, queryClient, userId]);

  const removeAttachment = useCallback(async (attachment: NoteAttachment) => {
    setBusy(true);
    try {
      await deleteNoteAttachment(attachment);
      queryClient.setQueryData<NoteAttachment[]>(
        notesKeys.attachments(noteId),
        previous => (previous ?? []).filter(item => item.id !== attachment.id),
      );
      notify('Załącznik usunięty', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się usunąć załącznika', 'error');
    } finally {
      setBusy(false);
    }
  }, [noteId, queryClient]);

  const recordAudio = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const attachment = await uploadNoteAttachment(userId, noteId, file);
      await queryClient.invalidateQueries({ queryKey: notesKeys.attachments(noteId) });
      try {
        const transcript = await transcribeNoteAudio(file);
        await updateAttachmentTranscript(attachment.id, transcript);
        notify('Nagranie i transkrypcja są gotowe', 'success');
      } catch {
        notify('Nagranie zapisano, ale transkrypcja się nie udała', 'error');
      }
      await queryClient.invalidateQueries({ queryKey: notesKeys.attachments(noteId) });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się zapisać nagrania', 'error');
    } finally {
      setBusy(false);
    }
  }, [noteId, queryClient, userId]);

  const uploadScan = useCallback(async (file: File, ocrText: string) => {
    setBusy(true);
    try {
      const attachment = await uploadNoteAttachment(userId, noteId, file);
      if (ocrText.trim()) await updateAttachmentOcr(attachment.id, ocrText.trim());
      await queryClient.invalidateQueries({ queryKey: notesKeys.attachments(noteId) });
      notify('Skan dokumentu został zapisany', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się zapisać skanu', 'error');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [noteId, queryClient, userId]);

  const scanText = useCallback(async (file: File) => {
    setBusy(true);
    try {
      return await recognizeNoteImage(file);
    } finally {
      setBusy(false);
    }
  }, []);

  return { attachments, isLoading, busy, uploadFiles, uploadScan, scanText, recordAudio, removeAttachment };
}
