import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  Grid3X3,
  Highlighter,
  Image,
  LayoutList,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Pin,
  Plus,
  Quote,
  Search,
  Strikethrough,
  Table2,
  Tag,
  Trash2,
  Underline,
  X,
} from 'lucide-react';

// ─── Relative date helper ────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'dziś';
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

// ─── Sanitize ────────────────────────────────────────────────────────────────

function sanitizeHtml(html: string): string {
  const FORBIDDEN = new Set(['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'style', 'base']);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walk = (el: Element) => {
    for (const child of Array.from(el.children).reverse()) {
      if (FORBIDDEN.has(child.tagName.toLowerCase())) { child.remove(); continue; }
      for (const attr of Array.from(child.attributes)) {
        if (attr.name.startsWith('on') || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  is_archived?: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Color Palette ────────────────────────────────────────────────────────────
// Each color has a bg, readable text colors, border, and dot for the swatch

const COLORS: {
  id: string;
  label: string;
  bg: string;
  border: string;
  dot: string;
  text: string;       // primary text on this bg
  textSub: string;    // secondary text on this bg
  tagBg: string;
  tagText: string;
}[] = [
  { id: 'default', label: 'Domyślny',    bg: 'var(--keep-bg-default)', border: 'var(--keep-border-default)', dot: '#64748b', text: 'var(--keep-text-default)', textSub: 'var(--keep-text-sub-default)', tagBg: 'var(--keep-tag-bg-default)', tagText: 'var(--keep-tag-text-default)' },
  { id: 'red',     label: 'Koralowy',    bg: 'var(--keep-bg-red)',     border: 'var(--keep-border-red)',     dot: '#ef4444', text: 'var(--keep-text-red)',     textSub: 'var(--keep-text-sub-red)',     tagBg: 'var(--keep-tag-bg-red)',     tagText: 'var(--keep-tag-text-red)' },
  { id: 'orange',  label: 'Pomarańczowy',bg: 'var(--keep-bg-orange)',   border: 'var(--keep-border-orange)',  dot: '#f97316', text: 'var(--keep-text-orange)',  textSub: 'var(--keep-text-sub-orange)',  tagBg: 'var(--keep-tag-bg-orange)',  tagText: 'var(--keep-tag-text-orange)' },
  { id: 'yellow',  label: 'Żółty',       bg: 'var(--keep-bg-yellow)',   border: 'var(--keep-border-yellow)',  dot: '#f59e0b', text: 'var(--keep-text-yellow)',  textSub: 'var(--keep-text-sub-yellow)',  tagBg: 'var(--keep-tag-bg-yellow)',  tagText: 'var(--keep-tag-text-yellow)' },
  { id: 'green',   label: 'Szałwia',     bg: 'var(--keep-bg-green)',    border: 'var(--keep-border-green)',   dot: '#22c55e', text: 'var(--keep-text-green)',   textSub: 'var(--keep-text-sub-green)',   tagBg: 'var(--keep-tag-bg-green)',   tagText: 'var(--keep-tag-text-green)' },
  { id: 'teal',    label: 'Teal',        bg: 'var(--keep-bg-teal)',     border: 'var(--keep-border-teal)',    dot: '#14b8a6', text: 'var(--keep-text-teal)',     textSub: 'var(--keep-text-sub-teal)',     tagBg: 'var(--keep-tag-bg-teal)',     tagText: 'var(--keep-tag-text-teal)' },
  { id: 'blue',    label: 'Niebieski',   bg: 'var(--keep-bg-blue)',     border: 'var(--keep-border-blue)',    dot: '#3b82f6', text: 'var(--keep-text-blue)',     textSub: 'var(--keep-text-sub-blue)',     tagBg: 'var(--keep-tag-bg-blue)',     tagText: 'var(--keep-tag-text-blue)' },
  { id: 'indigo',  label: 'Indygo',      bg: 'var(--keep-bg-indigo)',   border: 'var(--keep-border-indigo)',  dot: '#6366f1', text: 'var(--keep-text-indigo)',   textSub: 'var(--keep-text-sub-indigo)',   tagBg: 'var(--keep-tag-bg-indigo)',   tagText: 'var(--keep-tag-text-indigo)' },
  { id: 'purple',  label: 'Fioletowy',   bg: 'var(--keep-bg-purple)',   border: 'var(--keep-border-purple)',  dot: '#a855f7', text: 'var(--keep-text-purple)',   textSub: 'var(--keep-text-sub-purple)',   tagBg: 'var(--keep-tag-bg-purple)',   tagText: 'var(--keep-tag-text-purple)' },
  { id: 'pink',    label: 'Różowy',      bg: 'var(--keep-bg-pink)',     border: 'var(--keep-border-pink)',    dot: '#ec4899', text: 'var(--keep-text-pink)',     textSub: 'var(--keep-text-sub-pink)',     tagBg: 'var(--keep-tag-bg-pink)',     tagText: 'var(--keep-tag-text-pink)' },
];

const getColor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

// ─── Floating Toolbar & Rich Editor Helpers ─────────────────────────────────

function FloatingToolbar({
  range,
  onAction,
  activeState
}: {
  range: Range;
  onAction: (action: string) => void;
  activeState: { bold: boolean; italic: boolean; h1: boolean; list: boolean; underline: boolean; strikethrough: boolean; blockquote: boolean };
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rects = range.getClientRects();
    if (rects.length > 0) {
      const rect = rects[0];
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      setCoords({
        top: rect.top + scrollY - 10,
        left: rect.left + rect.width / 2 + scrollX
      });
    }
  }, [range]);

  return (
    <div
      ref={ref}
      className="keep-floating-toolbar"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('bold'); }}
        className={`keep-toolbar-btn ${activeState.bold ? 'active' : ''}`}
        title="Pogrubienie"
      >
        <span className="font-bold text-[11px]">B</span>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('italic'); }}
        className={`keep-toolbar-btn ${activeState.italic ? 'active' : ''}`}
        title="Kursywa"
      >
        <span className="italic text-[11px]">I</span>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('h1'); }}
        className={`keep-toolbar-btn ${activeState.h1 ? 'active' : ''}`}
        title="Nagłówek"
      >
        <span className="font-black text-[10px]">H</span>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('todo'); }}
        className={`keep-toolbar-btn ${activeState.list ? 'active' : ''}`}
        title="Zadanie"
      >
        <CheckSquare size={12} />
      </button>
      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('table'); }}
        className="keep-toolbar-btn"
        title="Wstaw tabelę"
      >
        <Table2 size={12} />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onAction('image'); }}
        className="keep-toolbar-btn"
        title="Wstaw zdjęcie"
      >
        <Image size={12} />
      </button>
    </div>
  );
}

function RichEditor({
  value,
  onChange,
  placeholder,
  className = '',
  style = {},
  showStaticBar = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
  showStaticBar?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [toolbarRange, setToolbarRange] = useState<Range | null>(null);
  const [activeState, setActiveState] = useState({ bold: false, italic: false, h1: false, list: false, underline: false, strikethrough: false, blockquote: false });
  const staticBarRef = useRef<HTMLDivElement>(null);
  // Saved selection before toolbar action steals focus
  const savedSelectionRef = useRef<{ range: Range } | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

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
        bar.style.cssText = `position:fixed;bottom:${keyboardH}px;left:0;right:0;z-index:99999;margin:0;border-radius:0;width:100%;padding:0 12px;`;
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

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setToolbarRange(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      setToolbarRange(range);
      savedSelectionRef.current = { range: range.cloneRange() };
      setActiveState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        h1: document.queryCommandValue('formatBlock') === 'h1',
        list: false,
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        blockquote: document.queryCommandValue('formatBlock') === 'blockquote',
      });
    } else {
      setToolbarRange(null);
    }
  };

  // Restore saved selection before executing a command
  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current.range);
      }
    }
    editorRef.current?.focus();
  };

  // Cross-platform HTML insertion — works on mobile where execCommand('insertHTML') fails
  const insertHTML = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        try {
          const frag = range.createContextualFragment(html);
          const lastNode = frag.lastChild;
          range.insertNode(frag);
          if (lastNode) {
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
          handleInput();
          return;
        } catch (_) { /* fall through to innerHTML append */ }
      }
    }
    // Fallback: append at end
    editor.innerHTML += html;
    handleInput();
    // Move cursor to end
    const newRange = document.createRange();
    newRange.selectNodeContents(editor);
    newRange.collapse(false);
    const s = window.getSelection();
    if (s) { s.removeAllRanges(); s.addRange(newRange); }
  };

  const handleAction = (action: string) => {
    if (action === 'bold') {
      restoreSelection();
      document.execCommand('bold', false);
      handleInput();
      handleSelection();
    } else if (action === 'italic') {
      restoreSelection();
      document.execCommand('italic', false);
      handleInput();
      handleSelection();
    } else if (action === 'h1') {
      restoreSelection();
      const isH1 = document.queryCommandValue('formatBlock') === 'h1';
      document.execCommand('formatBlock', false, isH1 ? '<p>' : '<h1>');
      handleInput();
      handleSelection();
    } else if (action === 'todo') {
      insertHTML('<div class="keep-todo-item"><span class="keep-todo-checkbox" contenteditable="false"></span><span class="keep-todo-text">Nowe zadanie</span></div><p><br></p>');
    } else if (action === 'table') {
      const tableHtml =
        '<table class="keep-table">' +
        '<thead><tr>' +
        '<th class="keep-td keep-th" contenteditable="true"><br></th>' +
        '<th class="keep-td keep-th" contenteditable="true"><br></th>' +
        '<th class="keep-td keep-th" contenteditable="true"><br></th>' +
        '</tr></thead>' +
        '<tbody>' +
        '<tr>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '</tr>' +
        '<tr>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '<td class="keep-td" contenteditable="true"><br></td>' +
        '</tr>' +
        '</tbody></table><p><br></p>';
      insertHTML(tableHtml);
    } else if (action === 'underline') {
      restoreSelection();
      document.execCommand('underline', false);
      handleInput();
      handleSelection();
    } else if (action === 'strikethrough') {
      restoreSelection();
      document.execCommand('strikeThrough', false);
      handleInput();
      handleSelection();
    } else if (action === 'highlight') {
      restoreSelection();
      document.execCommand('hiliteColor', false, '#fef08a');
      handleInput();
      handleSelection();
    } else if (action === 'blockquote') {
      restoreSelection();
      const isBlockquote = document.queryCommandValue('formatBlock') === 'blockquote';
      document.execCommand('formatBlock', false, isBlockquote ? '<p>' : '<blockquote>');
      handleInput();
      handleSelection();
    } else if (action === 'image') {
      imageInputRef.current?.click();
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Zdjęcie jest za duże (max 5 MB). Użyj mniejszego pliku.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      restoreSelection();
      document.execCommand('insertHTML', false,
        `<figure class="keep-figure" contenteditable="false">
          <img class="keep-inline-img" src="${src}" alt="Załącznik" />
        </figure><p><br></p>`);
      handleInput();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('keep-inline-img')) {
      e.preventDefault();
      const src = (target as HTMLImageElement).src;
      const a = document.createElement('a');
      a.href = src;
      a.download = `zdjecie-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (target.classList.contains('keep-todo-checkbox')) {
      e.preventDefault();
      const isChecked = target.classList.toggle('checked');
      const textSibling = target.nextElementSibling as HTMLElement;
      if (textSibling) {
        textSibling.classList.toggle('completed', isChecked);
      }
      handleInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Space conversion: auto-create checkbox when user types [], - [], - [ ], or * [ ] followed by Space
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (selection && selection.anchorNode && selection.rangeCount > 0) {
        const node = selection.anchorNode;
        const text = node.textContent || '';
        const offset = selection.anchorOffset;
        const textBefore = text.slice(0, offset);
        if (/^(?:\- \[ \]|\- \[\]|\[\]|\* \[ \])\s*$/.test(textBefore)) {
          e.preventDefault();
          const range = selection.getRangeAt(0);
          range.setStart(node, 0);
          range.setEnd(node, offset);
          range.deleteContents();
          insertHTML('<div class="keep-todo-item"><span class="keep-todo-checkbox" contenteditable="false"></span><span class="keep-todo-text">&nbsp;</span></div>');
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        let parent = selection.anchorNode.parentElement;
        let todoItem: HTMLElement | null = null;
        while (parent && parent !== editorRef.current) {
          if (parent.classList.contains('keep-todo-item')) {
            todoItem = parent;
            break;
          }
          parent = parent.parentElement;
        }

        if (todoItem) {
          e.preventDefault();
          const textNode = todoItem.querySelector('.keep-todo-text');
          const textVal = textNode?.textContent?.trim() || '';
          // If the item is empty, pressing Enter turns it back into a standard paragraph
          if (textVal === '' || textVal === '\u00a0' || textNode?.innerHTML === '<br>') {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            todoItem.parentNode?.replaceChild(p, todoItem);
            const r = document.createRange();
            r.selectNodeContents(p);
            r.collapse(true);
            selection.removeAllRanges();
            selection.addRange(r);
            handleInput();
            return;
          }

          // Otherwise, create a new checklist item below
          const newTodo = document.createElement('div');
          newTodo.className = 'keep-todo-item';
          newTodo.innerHTML = '<span class="keep-todo-checkbox" contenteditable="false"></span><span class="keep-todo-text">&nbsp;</span>';
          
          todoItem.parentNode?.insertBefore(newTodo, todoItem.nextSibling);
          
          const newTextSpan = newTodo.querySelector('.keep-todo-text') as HTMLElement;
          if (newTextSpan) {
            editorRef.current?.focus();
            const r = document.createRange();
            if (newTextSpan.firstChild) {
              r.setStart(newTextSpan.firstChild, 0);
              r.collapse(true);
            } else {
              r.selectNodeContents(newTextSpan);
              r.collapse(true);
            }
            selection.removeAllRanges();
            selection.addRange(r);
          }
          handleInput();
          return;
        }
      }
    }

    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.anchorNode && selection.isCollapsed) {
        let parent = selection.anchorNode.parentElement;
        let todoItem: HTMLElement | null = null;
        while (parent && parent !== editorRef.current) {
          if (parent.classList.contains('keep-todo-item')) {
            todoItem = parent;
            break;
          }
          parent = parent.parentElement;
        }

        if (todoItem) {
          const offset = selection.anchorOffset;
          // If cursor is at the very beginning of the checklist item, convert it back to a normal paragraph
          if (offset === 0) {
            e.preventDefault();
            const textNode = todoItem.querySelector('.keep-todo-text');
            const p = document.createElement('p');
            p.innerHTML = textNode?.innerHTML || '<br>';
            if (p.innerHTML === '&nbsp;' || p.innerHTML === '') {
              p.innerHTML = '<br>';
            }
            todoItem.parentNode?.replaceChild(p, todoItem);
            
            const r = document.createRange();
            if (p.firstChild) {
              r.setStart(p.firstChild, 0);
              r.collapse(true);
            } else {
              r.selectNodeContents(p);
              r.collapse(true);
            }
            selection.removeAllRanges();
            selection.addRange(r);
            handleInput();
            return;
          }
        }
      }
    }

    // Tab inside table: move to next cell
    if (e.key === 'Tab') {
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        let parent = selection.anchorNode.parentElement;
        while (parent && parent !== editorRef.current) {
          if (parent.tagName === 'TD') {
            e.preventDefault();
            const allCells = Array.from(editorRef.current?.querySelectorAll('.keep-td') || []);
            const idx = allCells.indexOf(parent);
            if (idx !== -1) {
              const next = allCells[idx + 1] as HTMLElement;
              if (next) {
                next.focus();
                const r = document.createRange();
                r.selectNodeContents(next);
                r.collapse(false);
                selection.removeAllRanges();
                selection.addRange(r);
              }
            }
            return;
          }
          parent = parent.parentElement;
        }
      }
    }
  };

  return (
    <div className="relative w-full">
      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        className={`keep-rich-editor ${className}`}
        style={style}
      />
      {/* CSS Placeholder fallback */}
      {(!value || value === '<br>' || value === '') && (
        <span className="absolute left-0 top-0 pointer-events-none text-text-muted opacity-50 text-[13px] select-none">
          {placeholder}
        </span>
      )}
      {/* Floating selection toolbar */}
      {toolbarRange && (
        <FloatingToolbar
          range={toolbarRange}
          onAction={handleAction}
          activeState={activeState}
        />
      )}
      {/* Static always-visible formatting bar — Apple Notes style */}
      {showStaticBar && (
        <div className="keep-static-bar" ref={staticBarRef}>
          {/* Text style group — iOS Notes Aa order */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('bold'); }}
            className={`keep-static-btn ${activeState.bold ? 'active' : ''}`}
            title="Pogrubienie"
          >
            <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'Georgia, serif', lineHeight: 1 }}>B</span>
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('italic'); }}
            className={`keep-static-btn ${activeState.italic ? 'active' : ''}`}
            title="Kursywa"
          >
            <span style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 15, fontFamily: 'Georgia, serif', lineHeight: 1 }}>I</span>
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('underline'); }}
            className={`keep-static-btn ${activeState.underline ? 'active' : ''}`}
            title="Podkreślenie"
          >
            <Underline size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('strikethrough'); }}
            className={`keep-static-btn ${activeState.strikethrough ? 'active' : ''}`}
            title="Przekreślenie"
          >
            <Strikethrough size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('h1'); }}
            className={`keep-static-btn ${activeState.h1 ? 'active' : ''}`}
            title="Nagłówek"
          >
            <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '-0.02em', lineHeight: 1 }}>H1</span>
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('blockquote'); }}
            className={`keep-static-btn ${activeState.blockquote ? 'active' : ''}`}
            title="Cytat"
          >
            <Quote size={18} strokeWidth={2} />
          </button>

          <div className="keep-static-sep" />

          {/* Block elements group */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('todo'); }}
            className="keep-static-btn"
            title="Lista zadań"
          >
            <CheckSquare size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('table'); }}
            className="keep-static-btn"
            title="Tabela"
          >
            <Table2 size={20} strokeWidth={1.5} />
          </button>

          <div className="keep-static-sep" />

          {/* Media & highlight group */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('highlight'); }}
            className="keep-static-btn"
            title="Zaznacz tekst"
          >
            <Highlighter size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleAction('image'); }}
            className="keep-static-btn"
            title="Dodaj zdjęcie"
          >
            <Image size={20} strokeWidth={1.5} />
          </button>
        </div>
      )}

    </div>
  );
}

// ─── Inline composer ─────────────────────────────────────────────────────────

function NoteComposer({ onSave, busy, autoExpand = false }: { onSave: (n: Partial<Note>) => void; busy: boolean; autoExpand?: boolean }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (!title.trim() && !content.trim()) setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [title, content]);

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      color,
      is_pinned: isPinned,
      is_archived: false,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
    setTitle(''); setContent(''); setColor('default'); setTagsInput(''); setIsPinned(false);
    setExpanded(false);
  };

  const c = getColor(color);

  return (
    <div ref={ref} className="keep-composer" style={{ backgroundColor: c.bg, borderColor: c.border }}>
      {!expanded ? (
        <button className="keep-composer-placeholder" onClick={() => setExpanded(true)} type="button">
          <span style={{ color: 'var(--text-muted)' }}>Utwórz notatkę…</span>
          <div className="keep-composer-quick-btns">
            <Plus size={18} />
          </div>
        </button>
      ) : (
        <div className="keep-composer-body">
          <div className="keep-composer-title-row">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tytuł"
              className="keep-composer-title"
              style={{ color: c.text }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <button
              onClick={() => setIsPinned(p => !p)}
              className={`keep-icon-btn ${isPinned ? 'active' : ''}`}
              title={isPinned ? 'Odepnij' : 'Przypnij'}
              type="button"
            >
              <Pin size={15} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          </div>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Utwórz notatkę…"
            className="keep-composer-content"
            style={{ color: c.textSub }}
            showStaticBar
          />
          <div className="keep-composer-tags-row">
            <Tag size={11} className="keep-tag-icon" />
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Tagi oddzielone przecinkiem…"
              className="keep-composer-tags-input"
            />
          </div>
          <div className="keep-composer-toolbar">
            <div className="keep-color-row">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.id)}
                  className={`keep-swatch ${color === c.id ? 'selected' : ''}`}
                  style={{ backgroundColor: c.dot }}
                />
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => { setTitle(''); setContent(''); setExpanded(false); }} className="keep-btn-ghost">Anuluj</button>
            <button type="button" onClick={handleSave} disabled={busy || (!title.trim() && !content.trim())} className="keep-btn-primary">
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Zapisz'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

// ─── Edit Note Modal ──────────────────────────────────────────────────────────

function EditNoteModal({
  note,
  onClose,
  onUpdate,
  onDelete,
  onTogglePin,
  busy,
}: {
  note: Note;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [showMenu, setShowMenu] = useState(false);
  const c = getColor(color);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setTagsInput(note.tags.join(', '));
  }, [note]);

  const handleSave = useCallback(() => {
    onUpdate(note.id, {
      title: title.trim(),
      content: content.trim(),
      color,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
    onClose();
  }, [color, content, note.id, onUpdate, onClose, tagsInput, title]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleSave(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  const noteDate = new Date(note.updated_at || note.created_at).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <>
      <div className="keep-modal-backdrop" onClick={e => { e.stopPropagation(); handleSave(); }} />
      <div
        className="keep-modal-content"
        style={{ backgroundColor: c.bg, borderColor: c.border }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── iOS navigation bar ── */}
        <nav className="keep-ios-nav" style={{ borderBottomColor: `${c.border}` }}>
          <button type="button" className="keep-ios-back" onClick={handleSave}>
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span>Notatki</span>
          </button>
          <span className="keep-ios-date" style={{ color: c.textSub }}>{noteDate}</span>
          <div className="keep-ios-nav-right">
            <button type="button" className="keep-ios-done" onClick={handleSave}>
              Gotowe
            </button>
            <button
              type="button"
              className="keep-ios-more"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            >
              <MoreHorizontal size={22} />
            </button>
          </div>
        </nav>

        {/* ── Overflow menu (iOS popover style) ── */}
        {showMenu && (
          <>
            <div className="keep-menu-overlay" onClick={() => setShowMenu(false)} />
            <div className="keep-menu" onClick={e => e.stopPropagation()}>
              <div className="keep-menu-colors">
                {COLORS.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    title={col.label}
                    onClick={() => setColor(col.id)}
                    className={`keep-swatch ${color === col.id ? 'selected' : ''}`}
                    style={{ backgroundColor: col.dot }}
                  />
                ))}
              </div>
              <div className="keep-menu-rule" />
              <button
                type="button"
                className="keep-menu-item"
                onClick={() => { onTogglePin(note); setShowMenu(false); }}
              >
                <Pin size={17} fill={note.is_pinned ? 'currentColor' : 'none'} />
                <span>{note.is_pinned ? 'Odepnij' : 'Przypnij'}</span>
              </button>
              <button
                type="button"
                className="keep-menu-item"
                onClick={() => { onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); setShowMenu(false); onClose(); }}
              >
                <Archive size={17} />
                <span>{note.is_archived ? 'Przywróć' : 'Archiwizuj'}</span>
              </button>
              <div className="keep-menu-rule" />
              <button
                type="button"
                className="keep-menu-item danger"
                onClick={() => { onDelete(note.id); onClose(); }}
                disabled={busy}
              >
                <Trash2 size={17} />
                <span>Usuń notatkę</span>
              </button>
            </div>
          </>
        )}

        {/* ── Note body ── */}
        <div className="keep-modal-body">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Tytuł"
            className="keep-ios-title-input"
            style={{ color: c.text }}
          />
          <div className="keep-ios-meta-row" style={{ borderBottomColor: c.border }}>
            <Tag size={10} style={{ opacity: 0.35, flexShrink: 0 }} />
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Tagi…"
              className="keep-ios-tags-input"
              style={{ color: c.textSub }}
            />
          </div>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Zacznij pisać…"
            className="keep-ios-editor"
            style={{ color: c.textSub }}
            showStaticBar
          />
        </div>
      </div>
    </>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onDelete,
  onTogglePin,
  onUpdate,
  busy,
  isEditing,
  onOpen,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
  isDragOver,
}: {
  note: Note;
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  busy: boolean;
  isEditing: boolean;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const c = getColor(note.color);

  return (
    <div
      ref={ref}
      className={`keep-card ${isEditing ? 'editing' : ''} ${note.is_pinned ? 'pinned' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{
        backgroundColor: c.bg,
        borderColor: isDragOver ? '#6366f1' : c.border,
        opacity: isEditing ? 0.6 : 1,
      }}
      onClick={() => onOpen(note.id)}
      draggable={!isEditing}
      onDragStart={() => onDragStart(note.id)}
      onDragEnter={() => onDragEnter(note.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {/* Pin badge */}
      {note.is_pinned && (
        <div className="keep-pin-badge">
          <Pin size={9} fill="currentColor" />
        </div>
      )}

      {/* Drag handle — shows on hover */}
      <div className="keep-drag-handle" title="Przeciągnij aby przenieść">
        <span />
        <span />
        <span />
      </div>

      {note.title && (
        <h3 className="keep-card-title" style={{ color: c.text }}>{note.title}</h3>
      )}
      {note.content && (
        <div
          className="keep-card-content"
          style={{ color: c.textSub }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('keep-todo-checkbox')) {
              e.stopPropagation();
              e.preventDefault();
              const container = document.createElement('div');
              container.innerHTML = note.content;
              const checkboxes = Array.from(e.currentTarget.querySelectorAll('.keep-todo-checkbox'));
              const index = checkboxes.indexOf(target);
              if (index !== -1) {
                const docCheckboxes = container.querySelectorAll('.keep-todo-checkbox');
                const targetCheckbox = docCheckboxes[index] as HTMLElement;
                if (targetCheckbox) {
                  const isChecked = targetCheckbox.classList.toggle('checked');
                  const sibling = targetCheckbox.nextElementSibling as HTMLElement;
                  if (sibling) {
                    sibling.classList.toggle('completed', isChecked);
                  }
                  onUpdate(note.id, { content: container.innerHTML });
                }
              }
            }
          }}
        />
      )}
      {note.tags.length > 0 && (
        <div className="keep-card-tags">
          {note.tags.map((t, i) => (
            <span key={i} className="keep-tag" style={{ background: c.tagBg, color: c.tagText, borderColor: 'transparent' }}>{t}</span>
          ))}
        </div>
      )}
      <div className="keep-card-footer" style={{ borderTopColor: 'rgba(255,255,255,0.08)' }}>
        <span className="keep-card-date" style={{ color: c.textSub, opacity: 0.6 }}>
          {relativeDate(note.updated_at || note.created_at)}
        </span>
         <div className="keep-card-actions">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onTogglePin(note); }}
            className={`keep-icon-btn ${note.is_pinned ? 'active' : ''}`}
            title={note.is_pinned ? 'Odepnij' : 'Przypnij'}
          >
            <Pin size={14} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUpdate(note.id, { is_archived: !note.is_archived, is_pinned: false }); }}
            className={`keep-icon-btn ${note.is_archived ? 'active' : ''}`}
            title={note.is_archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
          >
            <Archive size={14} fill={note.is_archived ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(note.id); }}
            disabled={busy}
            className="keep-icon-btn danger"
            title="Usuń"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Draggable Masonry grid ───────────────────────────────────────────────────

function MasonryGrid({
  notes,
  onDelete,
  onTogglePin,
  onUpdate,
  onReorder,
  busy,
  columns,
  editingId,
  onOpenCard,
}: {
  notes: Note[];
  onDelete: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onReorder: (dragId: string, overId: string) => void;
  busy: boolean;
  columns: number;
  editingId: string | null;
  onOpenCard: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Distribute notes into columns
  const cols: Note[][] = Array.from({ length: columns }, () => []);
  notes.forEach((note, i) => cols[i % columns].push(note));

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnter = (id: string) => setOverId(id);
  const handleDragEnd = () => {
    if (dragId && overId && dragId !== overId) {
      onReorder(dragId, overId);
    }
    setDragId(null);
    setOverId(null);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="keep-masonry" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {cols.map((col, ci) => (
        <div key={ci} className="keep-masonry-col">
          {col.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onUpdate={onUpdate}
              busy={busy}
              isEditing={editingId === note.id}
              onOpen={onOpenCard}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              isDragOver={overId === note.id && dragId !== note.id}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main Keep page ───────────────────────────────────────────────────────────

export default function Keep({ session, onBack, onNavigateTo }: { session: any; onBack?: () => void; onNavigateTo?: (dest: string) => void }) {
  const userId = session.user.id;
  const autoNewNote = new URLSearchParams(window.location.search).get('new') === '1'
    || localStorage.getItem('vanguard_keep_new') === '1';
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'archive'>('notes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState(3);
  const [editingId, setEditingId] = useState<string | null>(null);

  const goTo = (dest: string) => {
    if (onNavigateTo) {
      onNavigateTo(dest);
    } else {
      localStorage.setItem('vanguard_view', dest);
      window.location.href = '/';
    }
  };

  const handleOpenCard = useCallback((id: string) => setEditingId(id), []);
  const handleCloseCard = useCallback(() => setEditingId(null), []);

  // Responsive columns
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) {
        setColumns(viewMode === 'grid' ? 2 : 1);
      } else if (w < 900) {
        setColumns(2);
      } else if (w < 1300) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [viewMode]);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from('vanguard_notes')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) {
        if (err.code === 'PGRST205' || err.message?.includes('vanguard_notes')) {
          const local = localStorage.getItem('vanguard_local_keep_notes');
          setNotes(local ? JSON.parse(local) : []);
          return;
        }
        throw err;
      }
      setNotes(data || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchNotes();
      setLoading(false);
    })();
  }, [fetchNotes]);

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const sortNotes = (arr: Note[]) =>
    [...arr].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleCreate = async (partial: Partial<Note>) => {
    setBusy(true);
    setError(null);
    const payload = { user_id: userId, ...partial };
    try {
      const { data, error: err } = await (supabase as any)
        .from('vanguard_notes')
        .insert(payload)
        .select()
        .single();
      if (err) {
        if (err.code === 'PGRST205' || err.message?.includes('vanguard_notes')) {
          const local: Note = {
            id: Math.random().toString(36).slice(2),
            title: partial.title || '',
            content: partial.content || '',
            color: partial.color || 'default',
            is_pinned: partial.is_pinned || false,
            tags: partial.tags || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const updated = sortNotes([local, ...notes]);
          localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(updated));
          setNotes(updated);
          return;
        }
        throw err;
      }
      setNotes(prev => sortNotes([data, ...prev]));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Note>) => {
    try {
      const { error: err } = await (supabase as any)
        .from('vanguard_notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev =>
        sortNotes(prev.map(n => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)))
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      const { error: err } = await (supabase as any).from('vanguard_notes').delete().eq('id', id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePin = async (note: Note) => {
    const next = !note.is_pinned;
    try {
      const { error: err } = await (supabase as any)
        .from('vanguard_notes')
        .update({ is_pinned: next })
        .eq('id', note.id);
      if (err && !(err.code === 'PGRST205')) throw err;
      setNotes(prev => sortNotes(prev.map(n => (n.id === note.id ? { ...n, is_pinned: next } : n))));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ─── New note (iOS FAB) ──────────────────────────────────────────────────────

  const handleNewNote = useCallback(async () => {
    setBusy(true);
    setError(null);
    const empty = { user_id: userId, title: '', content: '', color: 'default', is_pinned: false, is_archived: false, tags: [] as string[] };
    try {
      const { data, error: err } = await (supabase as any).from('vanguard_notes').insert(empty).select().single();
      if (err) {
        if (err.code === 'PGRST205' || err.message?.includes('vanguard_notes')) {
          const local: Note = { id: Math.random().toString(36).slice(2), ...empty, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          setNotes(prev => [local, ...prev]);
          setEditingId(local.id);
          return;
        }
        throw err;
      }
      setNotes(prev => [data, ...prev]);
      setEditingId(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  // Auto-open new note when navigated with ?new=1 (Telegram shortcut)
  const autoNewNoteHandled = useRef(false);
  useEffect(() => {
    if (autoNewNote && !autoNewNoteHandled.current) {
      autoNewNoteHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      handleNewNote();
    }
  }, [autoNewNote, handleNewNote]);

  // Ctrl+N shortcut — new note
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !editingId) {
        e.preventDefault();
        handleNewNote();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, handleNewNote]);

  // ─── Drag & Drop reorder ─────────────────────────────────────────────────────

  const handleReorder = (dragId: string, overId: string) => {
    setNotes(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(n => n.id === dragId);
      const toIdx = arr.findIndex(n => n.id === overId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      // Only allow reordering within same group (pinned↔pinned or others↔others)
      if (arr[fromIdx].is_pinned !== arr[toIdx].is_pinned) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  // ─── Filter & search ────────────────────────────────────────────────────────

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort();

  const filtered = notes.filter(n => {
    const matchTab = sidebarTab === 'notes' ? !n.is_archived : !!n.is_archived;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q));
    const matchTag = !activeTag || n.tags.includes(activeTag);
    return matchTab && matchSearch && matchTag;
  });

  const pinned = sidebarTab === 'notes' ? filtered.filter(n => n.is_pinned) : [];
  const others = sidebarTab === 'notes' ? filtered.filter(n => !n.is_pinned) : filtered;

  const sharedGridProps = {
    onDelete: handleDelete,
    onTogglePin: handleTogglePin,
    onUpdate: handleUpdate,
    onReorder: handleReorder,
    busy,
    columns,
    editingId,
    onOpenCard: handleOpenCard,
  };


  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="keep-root">
      {/* ── Topbar ── */}
      <header className="keep-header">
        <div className="keep-header-left">
          <button onClick={() => onBack ? onBack() : (window.location.href = '/')} className="keep-back-btn" title="Wróć">
            <ArrowLeft size={16} />
          </button>
          <div className="keep-logo">
            <CheckSquare size={18} className="keep-logo-icon" />
            <span>Notatki</span>
          </div>
        </div>

        <div className="keep-search-wrap">
          <Search size={14} className="keep-search-icon" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj notatek…"
            className="keep-search"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="keep-search-clear">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="keep-header-right">
          <button
            type="button"
            onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
            className="keep-icon-btn"
            title={viewMode === 'grid' ? 'Lista' : 'Siatka'}
          >
            {viewMode === 'grid' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
          </button>
        </div>
      </header>

      <div className="keep-body">
        {/* ── Sidebar ── */}
        <aside className="keep-sidebar">
          <p className="keep-sidebar-section-label">Notatki</p>
          <button
            className={`keep-sidebar-item ${sidebarTab === 'notes' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('notes'); setActiveTag(null); }}
          >
            <CheckSquare size={15} />
            <span>Notatki</span>
            {notes.filter(n => !n.is_archived).length > 0 && (
              <span className="keep-sidebar-count">{notes.filter(n => !n.is_archived).length}</span>
            )}
          </button>
          <button
            className={`keep-sidebar-item ${sidebarTab === 'archive' && !activeTag ? 'active' : ''}`}
            onClick={() => { setSidebarTab('archive'); setActiveTag(null); }}
          >
            <Archive size={15} />
            <span>Archiwum</span>
            {notes.filter(n => n.is_archived).length > 0 && (
              <span className="keep-sidebar-count">{notes.filter(n => n.is_archived).length}</span>
            )}
          </button>

          <div className="keep-sidebar-separator" />

          <p className="keep-sidebar-section-label">Nawigacja</p>
          <button className="keep-sidebar-item" onClick={() => goTo('todo')}>
            <ListTodo size={15} />
            <span>To Do</span>
          </button>
          <button className="keep-sidebar-item" onClick={() => goTo('links')}>
            <BookOpen size={15} />
            <span>Pocket</span>
          </button>

          {allTags.length > 0 && (
            <>
              <div className="keep-sidebar-separator" />
              <p className="keep-sidebar-section-label">Tagi</p>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`keep-sidebar-item ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => { setSidebarTab('notes'); setActiveTag(t => (t === tag ? null : tag)); }}
                >
                  <Tag size={13} />
                  <span>{tag}</span>
                </button>
              ))}
            </>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="keep-main">
          {error && (
            <div className="keep-error">
              <AlertCircle size={14} />
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="keep-error-close"><X size={12} /></button>
            </div>
          )}


          {loading ? (
            <div className="keep-loading">
              <Loader2 size={28} className="animate-spin keep-loader-icon" />
              <p>Wczytuję notatki…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="keep-empty">
              <CheckSquare size={42} strokeWidth={1} className="keep-empty-icon" />
              <p className="keep-empty-title">
                {search || activeTag ? 'Brak wyników' : 'Brak notatek'}
              </p>
              <p className="keep-empty-sub">
                {search || activeTag
                  ? 'Spróbuj innego wyszukiwania lub filtra.'
                  : 'Utwórz pierwszą notatkę powyżej.'}
              </p>
            </div>
          ) : (
            <div className="keep-sections pb-20 md:pb-0">
              {/* Pinned */}
              {pinned.length > 0 && (
                <section className="keep-section">
                  <h2 className="keep-section-label">
                    <Pin size={11} fill="currentColor" /> Przypięte
                  </h2>
                  {viewMode === 'grid' ? (
                    <MasonryGrid notes={pinned} {...sharedGridProps} />
                  ) : (
                    <div className="keep-list">
                      {pinned.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onDelete={handleDelete}
                          onTogglePin={handleTogglePin}
                          onUpdate={handleUpdate}
                          busy={busy}
                          isEditing={editingId === note.id}
                          onOpen={handleOpenCard}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Others */}
              {others.length > 0 && (
                <section className="keep-section">
                  {pinned.length > 0 && (
                    <h2 className="keep-section-label">Inne</h2>
                  )}
                  {viewMode === 'grid' ? (
                    <MasonryGrid notes={others} {...sharedGridProps} />
                  ) : (
                    <div className="keep-list">
                      {others.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onDelete={handleDelete}
                          onTogglePin={handleTogglePin}
                          onUpdate={handleUpdate}
                          busy={busy}
                          isEditing={editingId === note.id}
                          onOpen={handleOpenCard}
                          onDragStart={() => {}}
                          onDragEnter={() => {}}
                          onDragEnd={() => {}}
                          onDragOver={e => e.preventDefault()}
                          isDragOver={false}
                        />
                      ))}

                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* iOS Notes-style FAB */}
      <button
        className="keep-fab"
        onClick={handleNewNote}
        disabled={busy}
        title="Nowa notatka"
        type="button"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : <Plus size={24} strokeWidth={2} />}
      </button>

      {/* Page-level Edit Modal */}
      {editingId && (
        (() => {
          const noteToEdit = notes.find(n => n.id === editingId);
          return noteToEdit ? (
            <EditNoteModal
              note={noteToEdit}
              onClose={handleCloseCard}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              busy={busy}
            />
          ) : null;
        })()
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <CheckSquare size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button onClick={() => goTo('todo')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => goTo('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
