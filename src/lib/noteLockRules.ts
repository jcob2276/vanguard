import type { Note } from './notesApi';

const IMAGE_EXTENSIONS = /\.(?:avif|gif|heic|heif|jpe?g|png|webp)$/i;
const DOCUMENT_SCAN = /^skan-[^/]*\.pdf$/i;

export function getNoteLockBlockReason(note: Note): string | null {
  if (note.tags.length > 0) {
    return 'Usuń tagi z notatki przed jej zablokowaniem.';
  }

  const unsupported = (note.attachment_names ?? []).find(name => (
    !IMAGE_EXTENSIONS.test(name) && !DOCUMENT_SCAN.test(name)
  ));
  if (unsupported) {
    return `Ten załącznik nie może znajdować się w zablokowanej notatce: ${unsupported}`;
  }

  return null;
}
