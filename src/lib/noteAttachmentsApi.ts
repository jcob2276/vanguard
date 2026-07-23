import { useQuery } from '@tanstack/react-query';
import type { Database } from './database.types';
import { notesKeys } from './queryKeys';
import { supabase } from './supabase';
import { invokeEdge } from './supabase';

export type NoteAttachment = Database['public']['Tables']['note_attachments']['Row'] & {
  signed_url?: string;
};

const BUCKET = 'note-attachments';
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const safeFileName = (name: string) => (
  name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'attachment'
);

async function withSignedUrl(attachment: NoteAttachment): Promise<NoteAttachment> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 60);
  if (error) throw new Error(error.message);
  return { ...attachment, signed_url: data.signedUrl };
}

export function useNoteAttachments(noteId: string) {
  return useQuery({
    queryKey: notesKeys.attachments(noteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_attachments')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return Promise.all((data ?? []).map(item => withSignedUrl(item)));
    },
    enabled: !!noteId,
  });
}

export async function uploadNoteAttachment(
  userId: string,
  noteId: string,
  file: File,
): Promise<NoteAttachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Plik przekracza limit 50 MB.');
  const path = `${userId}/${noteId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('note_attachments')
    .insert({
      user_id: userId,
      note_id: noteId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return withSignedUrl(data);
}

export async function deleteNoteAttachment(attachment: NoteAttachment): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase
    .from('note_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw new Error(error.message);
}

export async function deleteAllNoteAttachmentFiles(noteId: string): Promise<void> {
  const { data, error } = await supabase
    .from('note_attachments')
    .select('storage_path')
    .eq('note_id', noteId);
  if (error) throw new Error(error.message);
  const paths = (data ?? []).map(item => item.storage_path);
  if (!paths.length) return;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
  if (storageError) throw new Error(storageError.message);
}

export async function listUserNoteAttachments(userId: string): Promise<NoteAttachment[]> {
  const { data, error } = await supabase
    .from('note_attachments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function downloadNoteAttachmentFile(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(error.message);
  return data;
}

export async function transcribeNoteAudio(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('action', 'transcribe_only');
  const result = await invokeEdge('vanguard-capture', { body: form });
  if (!('type' in result) || result.type !== 'transcription') {
    throw new Error('Usługa nie zwróciła transkrypcji.');
  }
  return result.transcript;
}

export async function recognizeNoteImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('action', 'ocr_only');
  const result = await invokeEdge('vanguard-capture', { body: form });
  if (!('type' in result) || result.type !== 'ocr') {
    throw new Error('Usługa nie zwróciła tekstu OCR.');
  }
  return result.text;
}

export async function updateAttachmentTranscript(id: string, transcript: string): Promise<void> {
  const { error } = await supabase
    .from('note_attachments')
    .update({ transcript })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateAttachmentOcr(id: string, ocrText: string): Promise<void> {
  const { error } = await supabase
    .from('note_attachments')
    .update({ ocr_text: ocrText })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
