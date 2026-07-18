/**
 * @component RichEditorStaticBar
 * @role Stały pasek narzędzi edytora, wydzielony z RichEditor.tsx pod limit 300 linii.
 * @usedBy RichEditor
 */
import { Pressable } from '../ui/ControlPrimitives';
import { useRef, useEffect } from 'react';
import {
  Underline, Strikethrough, Quote, CheckSquare, Table2, Image, Highlighter,
  Heading2, List, ListOrdered, Indent, Outdent, Undo, Redo, Link2, Eraser,
} from 'lucide-react';

interface ActiveState {
  bold: boolean;
  italic: boolean;
  h1: boolean;
  h2: boolean;
  list: boolean;
  numList: boolean;
  underline: boolean;
  strikethrough: boolean;
  blockquote: boolean;
}

interface Props {
  activeState: ActiveState;
  showStaticBar: boolean;
  onAction: (action: string) => void;
}

function TextStyleGroup({ activeState, onAction }: { activeState: ActiveState; onAction: (a: string) => void }) {
  return (
    <>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('bold'); }} className={`keep-static-btn ${activeState.bold ? 'active' : ''}`} title="Pogrubienie">
        <span style={{ fontWeight: 'var(--ds-inline-style-800)', fontSize: 'var(--ds-inline-style-15)', fontFamily: 'var(--ds-inline-style-georgia-serif)', lineHeight: 'var(--ds-inline-style-1)' }}>B</span>
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('italic'); }} className={`keep-static-btn ${activeState.italic ? 'active' : ''}`} title="Kursywa">
        <span style={{ fontStyle: 'italic', fontWeight: 'var(--ds-inline-style-600)', fontSize: 'var(--ds-inline-style-15)', fontFamily: 'var(--ds-inline-style-georgia-serif)', lineHeight: 'var(--ds-inline-style-1)' }}>I</span>
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('underline'); }} className={`keep-static-btn ${activeState.underline ? 'active' : ''}`} title="Podkreślenie">
        <Underline size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('strikethrough'); }} className={`keep-static-btn ${activeState.strikethrough ? 'active' : ''}`} title="Przekreślenie">
        <Strikethrough size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('h1'); }} className={`keep-static-btn ${activeState.h1 ? 'active' : ''}`} title="Nagłówek H1">
        <span style={{ fontWeight: 'var(--ds-inline-style-800)', fontSize: 'var(--ds-inline-style-11)', letterSpacing: 'var(--ds-inline-style-0-02em)', lineHeight: 'var(--ds-inline-style-1)' }}>H1</span>
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('h2'); }} className={`keep-static-btn ${activeState.h2 ? 'active' : ''}`} title="Nagłówek H2">
        <Heading2 size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('blockquote'); }} className={`keep-static-btn ${activeState.blockquote ? 'active' : ''}`} title="Cytat">
        <Quote size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('highlight'); }} className="keep-static-btn" title="Zakreślacz">
        <Highlighter size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('clear'); }} className="keep-static-btn" title="Wyczyść formatowanie">
        <Eraser size={18} strokeWidth={2} />
      </Pressable>
    </>
  );
}

function BlockAndMediaGroup({ activeState, onAction }: { activeState: ActiveState; onAction: (a: string) => void }) {
  return (
    <>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('todo'); }} className="keep-static-btn" title="Lista zadań">
        <CheckSquare size={20} strokeWidth={1.5} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('bullet'); }} className={`keep-static-btn ${activeState.list ? 'active' : ''}`} title="Lista punktowana">
        <List size={20} strokeWidth={1.5} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('number'); }} className={`keep-static-btn ${activeState.numList ? 'active' : ''}`} title="Lista numerowana">
        <ListOrdered size={20} strokeWidth={1.5} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('table'); }} className="keep-static-btn" title="Tabela">
        <Table2 size={20} strokeWidth={1.5} />
      </Pressable>
      <div className="keep-static-sep" />
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('outdent'); }} className="keep-static-btn" title="Zmniejsz wcięcie">
        <Outdent size={20} strokeWidth={1.5} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('indent'); }} className="keep-static-btn" title="Zwiększ wcięcie">
        <Indent size={20} strokeWidth={1.5} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('undo'); }} className="keep-static-btn" title="Cofnij">
        <Undo size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('redo'); }} className="keep-static-btn" title="Ponów">
        <Redo size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('link'); }} className="keep-static-btn" title="Dodaj link">
        <Link2 size={18} strokeWidth={2} />
      </Pressable>
      <Pressable type="button" onMouseDown={e => { e.preventDefault(); onAction('image'); }} className="keep-static-btn" title="Dodaj zdjęcie">
        <Image size={20} strokeWidth={1.5} />
      </Pressable>
    </>
  );
}

export default function RichEditorStaticBar({ activeState, showStaticBar, onAction }: Props) {
  const staticBarRef = useRef<HTMLDivElement>(null);

  // Pin formatting bar above keyboard on mobile (iOS visualViewport API)
  useEffect(() => {
    if (!showStaticBar) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const reposition = () => {
      const bar = staticBarRef.current;
      if (!bar) return;
      const keyboardH = window.innerHeight - (vv.offsetTop + vv.height);
      if (keyboardH > 50) {
        bar.style.cssText = `position:fixed;bottom:${keyboardH}px;left:var(--ds-inline-css-0-coll-2);right:var(--ds-inline-css-0-coll-5);z-index:var(--ds-inline-css-99999);margin:var(--ds-inline-css-0-coll-3);border-radius:var(--ds-inline-css-0);width:var(--ds-inline-css-100);padding:var(--ds-inline-css-0-12px);`;
        bar.classList.add('kb-open');
      } else {
        bar.style.cssText = '';
        bar.classList.remove('kb-open');
      }
    };
    vv.addEventListener('resize', reposition);
    vv.addEventListener('scroll', reposition);
    return () => {
      vv.removeEventListener('resize', reposition);
      vv.removeEventListener('scroll', reposition);
    };
  }, [showStaticBar]);

  if (!showStaticBar) return null;

  return (
    <div className="keep-static-bar" ref={staticBarRef}>
      <TextStyleGroup activeState={activeState} onAction={onAction} />
      <div className="keep-static-sep" />
      <BlockAndMediaGroup activeState={activeState} onAction={onAction} />
    </div>
  );
}
