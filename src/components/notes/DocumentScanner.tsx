import { useRef, useState } from 'react';
import { Camera, Contrast, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { ControlInput, Pressable } from '../ui/ControlPrimitives';
import { createScanPdf, cycleScanFilter, rotateScanPage, type ScanPage } from '../../lib/scanDocument';
import { recognizeNoteImage } from '../../lib/noteAttachmentsApi';
import { notify } from '../../lib/notify';
import { correctDocumentPerspective } from '../../lib/documentPerspective';
import DocumentCornerEditor from './DocumentCornerEditor';
import FullscreenExperience from '../ui/FullscreenExperience';

interface Props {
  onClose: () => void;
  onComplete: (pdf: File, ocrText: string) => Promise<void>;
}

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export default function DocumentScanner({ onClose, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        const sourceDataUrl = await readFile(file);
        const dataUrl = await correctDocumentPerspective(sourceDataUrl);
        let ocrText = '';
        try { ocrText = await recognizeNoteImage(file); } catch { /* PDF remains usable without OCR. */ }
        setPages(previous => [...previous, {
          id: crypto.randomUUID(), sourceDataUrl, dataUrl, rotation: 0, filter: 'color', ocrText,
        }]);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się przetworzyć strony', 'error');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const pdf = await createScanPdf(pages);
      await onComplete(pdf, pages.map(page => page.ocrText).filter(Boolean).join('\n\n'));
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się utworzyć PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  const updatePage = (id: string, update: (page: ScanPage) => ScanPage) => {
    setPages(previous => previous.map(page => page.id === id ? update(page) : page));
  };

  return (
    <FullscreenExperience label="Skanuj dokument" tone="dark">
      <header className="flex items-center justify-between p-4">
        <Pressable variant="ghost" onClick={onClose} aria-label="Zamknij skaner"><X /></Pressable>
        <strong>Skanuj dokument</strong>
        <Pressable variant="ghost" disabled={!pages.length || busy} onClick={() => { void finish(); }}>Zachowaj</Pressable>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        {!pages.length && !busy && (
          <Pressable className="flex h-full w-full flex-col items-center justify-center gap-3" onClick={() => inputRef.current?.click()}>
            <Camera size={44} /><span>Ustaw dokument w kadrze</span>
          </Pressable>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {pages.map((page, index) => (
            <article key={page.id} className="rounded-xl bg-on-accent/10 p-2">
              <img
                src={page.dataUrl}
                alt={`Strona ${index + 1}`}
                className={`mx-auto max-h-[var(--ios-document-page-height)] ${page.filter === 'grayscale' ? 'grayscale' : page.filter === 'contrast' ? 'grayscale contrast-150' : ''}`}
                style={{ transform: `rotate(${page.rotation}deg)` }}
              />
              <div className="mt-2 flex justify-center gap-2">
                <Pressable variant="ghost" onClick={() => updatePage(page.id, rotateScanPage)}><RotateCw size={16} /></Pressable>
                <Pressable variant="ghost" onClick={() => updatePage(page.id, cycleScanFilter)}><Contrast size={16} /></Pressable>
                <Pressable variant="ghost" onClick={() => setAdjustingId(page.id)}>Narożniki</Pressable>
                <Pressable variant="ghost" className="text-danger" onClick={() => setPages(items => items.filter(item => item.id !== page.id))}><Trash2 size={16} /></Pressable>
              </div>
            </article>
          ))}
        </div>
        {busy && <div className="flex h-full items-center justify-center gap-2"><Loader2 className="animate-spin" /> Przetwarzanie…</div>}
      </main>
      <footer className="flex justify-center p-4">
        <Pressable onClick={() => inputRef.current?.click()} disabled={busy}><Camera size={16} /> {pages.length ? 'Dodaj stronę' : 'Zrób skan'}</Pressable>
      </footer>
      <ControlInput ref={inputRef} hidden type="file" accept="image/*" capture="environment" multiple onChange={event => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        void addFiles(files);
      }} />
      {adjustingId && (() => {
        const page = pages.find(item => item.id === adjustingId);
        return page?.sourceDataUrl ? (
          <DocumentCornerEditor
            source={page.sourceDataUrl}
            onCancel={() => setAdjustingId(null)}
            onApply={dataUrl => {
              updatePage(page.id, current => ({ ...current, dataUrl }));
              setAdjustingId(null);
            }}
          />
        ) : null;
      })()}
    </FullscreenExperience>
  );
}
