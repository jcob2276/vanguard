import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NoteAttachment } from '../../lib/noteAttachmentsApi';
import NoteAttachmentsView from './NoteAttachmentsView';

const attachment: NoteAttachment = {
  id: 'attachment-1',
  user_id: 'user-1',
  note_id: 'note-1',
  storage_path: 'user-1/note-1/file.png',
  file_name: 'diagram.png',
  mime_type: 'image/png',
  size_bytes: 2048,
  created_at: '2026-07-23T10:00:00.000Z',
  transcript: null,
  ocr_text: null,
  signed_url: 'https://example.test/signed-image',
};

describe('NoteAttachmentsView', () => {
  it('renders a stored attachment using its signed URL', () => {
    render(
      <NoteAttachmentsView
        attachments={[attachment]}
        loading={false}
        busy={false}
        onUpload={vi.fn()}
        onScan={vi.fn()}
        onScanText={vi.fn()}
        onRecord={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('diagram.png').closest('a')).toHaveAttribute('href', attachment.signed_url);
    expect(screen.getByRole('img')).toHaveAttribute('src', attachment.signed_url);
  });

  it('passes selected files to the upload handler', () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <NoteAttachmentsView
        attachments={[]}
        loading={false}
        busy={false}
        onUpload={onUpload}
        onScan={vi.fn()}
        onScanText={vi.fn()}
        onRecord={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'document.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('opens the multi-page document scanner', () => {
    render(
      <NoteAttachmentsView attachments={[]} loading={false} busy={false}
        onUpload={vi.fn()} onScan={vi.fn()} onScanText={vi.fn()} onRecord={vi.fn()} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Dodaj'));
    fireEvent.click(screen.getByText('Skanuj dokument'));
    expect(screen.getByText('Skanuj dokument')).toBeInTheDocument();
  });

  it('renders audio playback and its transcription', () => {
    render(
      <NoteAttachmentsView
        attachments={[{
          ...attachment,
          id: 'audio-1',
          file_name: 'nagranie.webm',
          mime_type: 'audio/webm',
          transcript: 'Treść nagrania',
        }]}
        loading={false}
        busy={false}
        onUpload={vi.fn()}
        onScan={vi.fn()}
        onScanText={vi.fn()}
        onRecord={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Treść nagrania')).toBeInTheDocument();
    expect(document.querySelector('audio')).toHaveAttribute('src', attachment.signed_url);
  });
});
