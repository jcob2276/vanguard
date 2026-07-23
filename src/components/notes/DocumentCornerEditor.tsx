import { useRef, useState } from 'react';
import { Pressable } from '../ui/ControlPrimitives';
import {
  correctDocumentPerspective,
  DEFAULT_DOCUMENT_CORNERS,
  type DocumentCorners,
  type NormalizedPoint,
} from '../../lib/documentPerspective';
import FullscreenExperience from '../ui/FullscreenExperience';

interface Props {
  source: string;
  onCancel: () => void;
  onApply: (corrected: string) => void;
}

type CornerName = keyof DocumentCorners;

export default function DocumentCornerEditor({ source, onCancel, onApply }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState(DEFAULT_DOCUMENT_CORNERS);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<CornerName | null>(null);

  const moveCorner = (name: CornerName, clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point: NormalizedPoint = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
    setCorners(previous => ({ ...previous, [name]: point }));
  };

  const points = [
    corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft,
  ].map(point => `${point.x * 100},${point.y * 100}`).join(' ');

  return (
    <FullscreenExperience label="Dopasuj narożniki dokumentu" tone="dark" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <Pressable variant="ghost" onClick={onCancel}>Anuluj</Pressable>
        <strong>Dopasuj narożniki</strong>
        <Pressable variant="ghost" disabled={busy} onClick={() => {
          setBusy(true);
          void correctDocumentPerspective(source, corners).then(onApply).finally(() => setBusy(false));
        }}>{busy ? 'Przetwarzanie…' : 'Gotowe'}</Pressable>
      </div>
      <div
        ref={frameRef}
        className="relative m-auto max-h-[var(--ios-document-editor-height)] max-w-4xl"
        onPointerMove={event => { if (dragging) moveCorner(dragging, event.clientX, event.clientY); }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <img src={source} alt="Dopasowanie dokumentu" className="max-h-[var(--ios-document-editor-height)] max-w-full" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polygon points={points} fill="var(--ios-scanner-selection-fill)" stroke="var(--ios-scanner-selection)" strokeWidth=".7" />
        </svg>
        {(Object.keys(corners) as CornerName[]).map(name => (
          <Pressable
            key={name}
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-on-accent bg-warning shadow-lg"
            style={{ left: `${corners[name].x * 100}%`, top: `${corners[name].y * 100}%`, touchAction: 'none' }}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(name);
              moveCorner(name, event.clientX, event.clientY);
            }}
            aria-label={`Narożnik ${name}`}
          />
        ))}
      </div>
    </FullscreenExperience>
  );
}
