import { useEffect, useRef, useState } from 'react';
import { Underline, Strikethrough, Quote, CheckSquare, Table2, Image, Highlighter } from 'lucide-react';
import FloatingToolbar from './FloatingToolbar';
import { notify } from '../../lib/notify';

export default function RichEditor({
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
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();

      const newTodo = document.createElement('div');
      newTodo.className = 'keep-todo-item';
      const checkbox = document.createElement('span');
      checkbox.className = 'keep-todo-checkbox';
      checkbox.setAttribute('contenteditable', 'false');
      newTodo.appendChild(checkbox);
      const textSpan = document.createElement('span');
      textSpan.className = 'keep-todo-text';
      textSpan.innerHTML = ' ';
      newTodo.appendChild(textSpan);

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(newTodo);
        } else {
          editor.appendChild(newTodo);
        }
      } else {
        editor.appendChild(newTodo);
      }

      const r = document.createRange();
      if (textSpan.firstChild) {
        r.setStart(textSpan.firstChild, 0);
      } else {
        r.selectNodeContents(textSpan);
      }
      r.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(r);
      handleInput();
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
      notify('Zdjęcie jest za duże (max 5 MB). Użyj mniejszego pliku.', 'error');
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
        if (/^(?:- \[ \]|- \[\]|\[\]|\* \[ \])\s*$/.test(textBefore)) {
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
          const textNode = todoItem.querySelector('.keep-todo-text') as HTMLElement;
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

          // Split the checklist item at the cursor
          const range = selection.getRangeAt(0);
          const afterRange = document.createRange();
          afterRange.setStart(range.startContainer, range.startOffset);
          afterRange.setEndAfter(textNode.lastChild || textNode);
          
          let frag: DocumentFragment;
          try {
            frag = afterRange.extractContents();
          } catch (err) {
            frag = document.createDocumentFragment();
          }

          // If the original text became empty, fill with &nbsp;
          if (textNode.textContent?.trim() === '') {
            textNode.innerHTML = '&nbsp;';
          }

          // Create new checklist item below
          const newTodo = document.createElement('div');
          newTodo.className = 'keep-todo-item';
          
          const checkbox = document.createElement('span');
          checkbox.className = 'keep-todo-checkbox';
          checkbox.setAttribute('contenteditable', 'false');
          newTodo.appendChild(checkbox);
          
          const newTextSpan = document.createElement('span');
          newTextSpan.className = 'keep-todo-text';
          
          if (!frag || frag.textContent?.trim() === '') {
            newTextSpan.innerHTML = '&nbsp;';
          } else {
            newTextSpan.appendChild(frag);
          }
          newTodo.appendChild(newTextSpan);
          
          todoItem.parentNode?.insertBefore(newTodo, todoItem.nextSibling);
          
          // Position cursor at start of new item
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
