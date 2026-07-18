/**
 * @component FloatingToolbar
 * @role Pływający pasek formatowania pokazywany przy zaznaczeniu tekstu.
 * @usedBy RichEditor
 */
import { Pressable } from '../ui/ControlPrimitives';
import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Table2, Image } from 'lucide-react';

export default function FloatingToolbar({
  range,
  onAction,
  activeState
}: {
  range: Range;
  onAction: (action: string) => void;
  activeState: {
    bold: boolean;
    italic: boolean;
    h1: boolean;
    h2: boolean;
    list: boolean;
    numList: boolean;
    underline: boolean;
    strikethrough: boolean;
    blockquote: boolean;
  };
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rects = range.getClientRects();
    if (rects.length > 0) {
      const rect = rects[0];
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      void (async () => {
        setCoords({
          top: rect.top + scrollY - 10,
          left: rect.left + rect.width / 2 + scrollX
        });
      })();
    }
  }, [range]);

  return (
    <div
      ref={ref}
      className="keep-floating-toolbar"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('bold'); }}
        className={`keep-toolbar-btn ${activeState.bold ? 'active' : ''}`}
        title="Pogrubienie"
      >
        <span className="font-bold text-xs">B</span>
      </Pressable>
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('italic'); }}
        className={`keep-toolbar-btn ${activeState.italic ? 'active' : ''}`}
        title="Kursywa"
      >
        <span className="italic text-xs">I</span>
      </Pressable>
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('h1'); }}
        className={`keep-toolbar-btn ${activeState.h1 ? 'active' : ''}`}
        title="Nagłówek"
      >
        <span className="font-black text-xs">H</span>
      </Pressable>
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('todo'); }}
        className={`keep-toolbar-btn ${activeState.list ? 'active' : ''}`}
        title="Zadanie"
      >
        <CheckSquare size={12} />
      </Pressable>
      {/* Divider */}
      <div style={{ width: 'var(--ds-inline-style-1-coll-2)', height: 'var(--ds-inline-style-18)', background: 'var(--color-theme-hex-ba255255255012)', margin: 'var(--ds-inline-style-0-2px)' }} />
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('table'); }}
        className="keep-toolbar-btn"
        title="Wstaw tabelę"
      >
        <Table2 size={12} />
      </Pressable>
      <Pressable
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('image'); }}
        className="keep-toolbar-btn"
        title="Wstaw zdjęcie"
      >
        <Image size={12} />
      </Pressable>
    </div>
  );
}
