import { Camera, File as FileIcon, Paperclip, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { NoteAttachment } from '../../lib/noteAttachmentsApi';
import { confirmDialog } from '../../lib/notify';
import { ControlInput, Pressable } from '../ui/ControlPrimitives';
import NoteAudioRecorder from './NoteAudioRecorder';
import DocumentScanner from './DocumentScanner';

interface NoteAttachmentsViewProps {
  attachments: NoteAttachment[];
  loading: boolean;
  busy: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onScan: (pdf: File, ocrText: string) => Promise<void>;
  onScanText: (file: File) => Promise<void>;
  onRecord: (file: File) => Promise<void>;
  onDelete: (attachment: NoteAttachment) => Promise<void>;
}

const formatSize = (bytes: number) => (
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
);

export default function NoteAttachmentsView({
  attachments,
  loading,
  busy,
  onUpload,
  onScan,
  onScanText,
  onRecord,
  onDelete,
}: NoteAttachmentsViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const textScanRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-t border-border-custom/20 py-3" aria-label="Załączniki">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wide text-text-muted">
          <Paperclip size={12} /> Załączniki {attachments.length ? `(${attachments.length})` : ''}
        </span>
        <div className="relative">
          <Pressable variant="ghost" size="sm" disabled={busy} onClick={() => setAttachmentMenu(value => !value)}>
            <Paperclip size={14} /> Dodaj
          </Pressable>
          {attachmentMenu && (
            <div className="absolute bottom-9 right-0 z-[var(--z-sticky)] flex w-48 flex-col rounded-xl border border-border-custom bg-surface-solid p-1 shadow-xl">
              <Pressable variant="ghost" className="justify-start" onClick={() => { setAttachmentMenu(false); setScanning(true); }}>
                <Camera size={14} /> Skanuj dokument
              </Pressable>
              <Pressable variant="ghost" className="justify-start" onClick={() => { setAttachmentMenu(false); textScanRef.current?.click(); }}>
                Skanuj tekst
              </Pressable>
              <NoteAudioRecorder disabled={busy} onRecorded={file => { setAttachmentMenu(false); return onRecord(file); }} />
              <Pressable variant="ghost" className="justify-start" onClick={() => { setAttachmentMenu(false); inputRef.current?.click(); }}>
                Dodaj plik
              </Pressable>
            </div>
          )}
        </div>
        <ControlInput
          ref={inputRef}
          hidden
          type="file"
          multiple
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void onUpload(files);
          }}
        />
        <ControlInput ref={textScanRef} hidden type="file" accept="image/*" capture="environment" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onScanText(file);
        }} />
      </div>

      {loading && <p className="text-xs text-text-muted">Ładowanie załączników…</p>}
      {!loading && attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attachments.map(attachment => (
            <div key={attachment.id} className="contents">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border-custom/30 p-2">
              {attachment.mime_type.startsWith('image/') && attachment.signed_url ? (
                <img src={attachment.signed_url} alt={attachment.file_name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <FileIcon size={20} className="shrink-0 text-text-muted" />
              )}
              {attachment.mime_type.startsWith('audio/') && attachment.signed_url && (
                <audio controls preload="metadata" src={attachment.signed_url} className="max-w-40" />
              )}
              <a
                className="min-w-0 flex-1"
                href={attachment.signed_url}
                download={attachment.file_name}
                target="_blank"
                rel="noreferrer"
              >
                <span className="block truncate text-xs font-semibold">{attachment.file_name}</span>
                <span className="text-4xs text-text-muted">{formatSize(attachment.size_bytes)}</span>
              </a>
              <Pressable
                variant="ghost"
                size="sm"
                className="shrink-0 text-danger"
                title="Usuń załącznik"
                onClick={() => {
                  void confirmDialog('Usunąć ten załącznik?').then(async confirmed => {
                    if (confirmed) await onDelete(attachment);
                  });
                }}
              >
                <Trash2 size={13} />
              </Pressable>
            </div>
            {attachment.transcript && (
              <p className="col-span-full rounded-lg bg-surface-2/40 p-2 text-xs leading-relaxed text-text-secondary">
                {attachment.transcript}
              </p>
            )}
            </div>
          ))}
        </div>
      )}
      {scanning && <DocumentScanner onClose={() => setScanning(false)} onComplete={onScan} />}
    </section>
  );
}
