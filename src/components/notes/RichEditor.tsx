/**
 * RichEditor — świadomy wyjątek od limitu 300 linii (FRONTEND_GUIDE.md §13.8).
 * Gęsta logika kursora/selekcji (Range, document.execCommand, visualViewport)
 * wymaga utrzymania stanu w jednym miejscu — rozbicie grozi subtelnymi bugami
 * z kursorem (skaczący kursor, utrata selekcji przy zmianie narzędzia).
 * StaticBar wyekstrahowany do RichEditorStaticBar.tsx.
 */
import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useEffect, useRef, useState } from 'react';
import FloatingToolbar from './FloatingToolbar';
import RichEditorStaticBar from './RichEditorStaticBar';
import { notify } from '../../lib/notify';
import { SLASH_COMMANDS } from './richEditorCommands';
export default function RichEditor({
  value,
  onChange,
  placeholder,
  className = '',
  style = {},
  showStaticBar = false,
  allNotes = [],
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
  showStaticBar?: boolean;
  allNotes?: Array<{ id: string; title: string }>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [toolbarRange, setToolbarRange] = useState<Range | null>(null);
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    list: false,
    numList: false,
    underline: false,
    strikethrough: false,
    blockquote: false
  });
  // Saved selection before toolbar action steals focus
  const savedSelectionRef = useRef<{ range: Range } | null>(null);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showWikiMenu, setShowWikiMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [slashSearchQuery, setSlashSearchQuery] = useState('');
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  const filteredSlashCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(slashSearchQuery.toLowerCase())
  );

  const filteredWikiNotes = (allNotes || [])
    .filter(n => n.title.toLowerCase().includes(wikiSearchQuery.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);


  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const checkTriggers = () => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !selection.rangeCount) return;
    const node = selection.anchorNode;
    const text = node.textContent || '';
    const offset = selection.anchorOffset;
    const textBefore = text.slice(0, offset);

    // 1. Check for WikiLink trigger "[["
    const wikiIdx = textBefore.lastIndexOf('[[');
    if (wikiIdx !== -1 && wikiIdx >= textBefore.lastIndexOf(']]')) {
      const query = textBefore.slice(wikiIdx + 2);
      if (!showWikiMenu || wikiSearchQuery !== query) {
        setWikiSearchQuery(query);
        setSelectedMenuIndex(0);
      }
      setShowWikiMenu(true);
      setShowSlashMenu(false);

      const range = selection.getRangeAt(0).cloneRange();
      try {
        range.setStart(node, wikiIdx);
        range.setEnd(node, offset);
        const rects = range.getClientRects();
        if (rects.length > 0 && editorRef.current) {
          const parentRect = editorRef.current.getBoundingClientRect();
          setMenuCoords({
            top: rects[0].bottom - parentRect.top + editorRef.current.scrollTop + 6,
            left: rects[0].left - parentRect.left
          });
        }
      } catch (e: unknown) {
      console.error('[Action Error]', e);
      notify(e instanceof Error ? e.message : 'Wystąpił błąd', 'error');
    }
      return;
    } else {
      setShowWikiMenu(false);
    }

    // 2. Check for Slash Command trigger "/"
    const slashIdx = textBefore.lastIndexOf('/');
    if (slashIdx !== -1 && (slashIdx === 0 || textBefore.charAt(slashIdx - 1) === ' ' || textBefore.charAt(slashIdx - 1) === '\u00a0')) {
      const query = textBefore.slice(slashIdx + 1);
      if (!query.includes(' ')) {
        if (!showSlashMenu || slashSearchQuery !== query) {
          setSlashSearchQuery(query);
          setSelectedMenuIndex(0);
        }
        setShowSlashMenu(true);
        setShowWikiMenu(false);

        const range = selection.getRangeAt(0).cloneRange();
        try {
          range.setStart(node, slashIdx);
          range.setEnd(node, offset);
          const rects = range.getClientRects();
          if (rects.length > 0 && editorRef.current) {
            const parentRect = editorRef.current.getBoundingClientRect();
            setMenuCoords({
              top: rects[0].bottom - parentRect.top + editorRef.current.scrollTop + 6,
              left: rects[0].left - parentRect.left
            });
          }
        } catch (e: unknown) {
      console.error('[Action Error]', e);
      notify(e instanceof Error ? e.message : 'Wystąpił błąd', 'error');
    }
        return;
      }
    }

    setShowSlashMenu(false);
  };

  const executeSlashCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
    if (!cmd) return;
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !selection.rangeCount) return;
    const node = selection.anchorNode;
    const offset = selection.anchorOffset;
    const text = node.textContent || '';
    const slashIdx = text.slice(0, offset).lastIndexOf('/');

    if (slashIdx !== -1) {
      const range = selection.getRangeAt(0);
      range.setStart(node, slashIdx);
      range.setEnd(node, offset);
      range.deleteContents();
    }

    setShowSlashMenu(false);
    setSelectedMenuIndex(0);

    if (cmd.key === 'todo') {
      handleAction('todo');
    } else if (cmd.key === 'h1') {
      document.execCommand('formatBlock', false, '<h1>');
      handleInput();
    } else if (cmd.key === 'h2') {
      document.execCommand('formatBlock', false, '<h2>');
      handleInput();
    } else if (cmd.key === 'bullet') {
      document.execCommand('insertUnorderedList', false);
      handleInput();
    } else if (cmd.key === 'code') {
      insertHTML('<pre class="keep-code-block" contenteditable="true">Blok kodu...</pre><p><br></p>');
    } else if (cmd.key === 'callout') {
      insertHTML('<div class="keep-callout-block" contenteditable="true">💡 Wpisz ważne info tutaj...</div><p><br></p>');
    }
  };

  const executeWikiLink = (note: { id: string; title: string }) => {
    if (!note) return;
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !selection.rangeCount) return;
    const node = selection.anchorNode;
    const offset = selection.anchorOffset;
    const text = node.textContent || '';
    const wikiIdx = text.slice(0, offset).lastIndexOf('[[');

    if (wikiIdx !== -1) {
      const range = selection.getRangeAt(0);
      range.setStart(node, wikiIdx);
      range.setEnd(node, offset);
      range.deleteContents();
    }

    setShowWikiMenu(false);
    setSelectedMenuIndex(0);

    const linkHtml = `<a href="#" class="wiki-link" data-note-id="${note.id}">[[${note.title}]]</a>&nbsp;`;
    insertHTML(linkHtml);
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
        h2: document.queryCommandValue('formatBlock') === 'h2',
        list: document.queryCommandState('insertUnorderedList'),
        numList: document.queryCommandState('insertOrderedList'),
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
        } catch (_: unknown) { /* fall through to innerHTML append */ }
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
    } else if (action === 'h2') {
      restoreSelection();
      const isH2 = document.queryCommandValue('formatBlock') === 'h2';
      document.execCommand('formatBlock', false, isH2 ? '<p>' : '<h2>');
      handleInput();
      handleSelection();
    } else if (action === 'bullet') {
      restoreSelection();
      document.execCommand('insertUnorderedList', false);
      handleInput();
      handleSelection();
    } else if (action === 'number') {
      restoreSelection();
      document.execCommand('insertOrderedList', false);
      handleInput();
      handleSelection();
    } else if (action === 'indent') {
      restoreSelection();
      document.execCommand('indent', false);
      handleInput();
      handleSelection();
    } else if (action === 'outdent') {
      restoreSelection();
      document.execCommand('outdent', false);
      handleInput();
      handleSelection();
    } else if (action === 'undo') {
      restoreSelection();
      document.execCommand('undo', false);
      handleInput();
      handleSelection();
    } else if (action === 'redo') {
      restoreSelection();
      document.execCommand('redo', false);
      handleInput();
      handleSelection();
    } else if (action === 'link') {
      restoreSelection();
      const url = window.prompt('Wpisz adres URL odnośnika:');
      if (url !== null) {
        document.execCommand('createLink', false, url);
        handleInput();
      }
      handleSelection();
    } else if (action === 'clear') {
      restoreSelection();
      document.execCommand('removeFormat', false);
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
      document.execCommand('hiliteColor', false, getComputedStyle(document.documentElement).getPropertyValue('--color-theme-hex-fef08a').trim());
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
    if (target.classList.contains('wiki-link')) {
      e.preventDefault();
      const noteId = target.getAttribute('data-note-id');
      if (noteId) {
        target.dispatchEvent(new CustomEvent('wiki-link-navigate', { bubbles: true, detail: { noteId } }));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showSlashMenu || showWikiMenu) {
      const maxIndex = showSlashMenu ? filteredSlashCommands.length - 1 : filteredWikiNotes.length - 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showSlashMenu) {
          if (filteredSlashCommands[selectedMenuIndex]) {
            executeSlashCommand(filteredSlashCommands[selectedMenuIndex]);
          }
        } else {
          if (filteredWikiNotes[selectedMenuIndex]) {
            executeWikiLink(filteredWikiNotes[selectedMenuIndex]);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setShowWikiMenu(false);
        return;
      }
    }

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
          } catch {
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
      <ControlInput
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />
      <div
        ref={editorRef}
        contentEditable
        onInput={() => { handleInput(); checkTriggers(); }}
        onMouseUp={handleSelection}
        onKeyUp={() => { handleSelection(); checkTriggers(); }}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        className={`keep-rich-editor ${className}`}
        style={style}
      />
      {showSlashMenu && menuCoords && filteredSlashCommands.length > 0 && (
        <div
          className="keep-autocomplete-menu"
          style={{ top: menuCoords.top, left: menuCoords.left }}
          onMouseDown={e => e.preventDefault()}
        >
          {filteredSlashCommands.map((cmd, i) => (
            <Pressable
              key={cmd.key}
              type="button"
              className={`keep-autocomplete-item ${i === selectedMenuIndex ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); executeSlashCommand(cmd); }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-inline-style-8-coll-3)' }}>
                <span style={{ fontSize: 'var(--ds-inline-style-14)', width: 'var(--ds-inline-style-20-coll-3)', textAlign: 'center', flexShrink: 0 }}>{cmd.icon}</span>
                <strong style={{ fontSize: 'var(--ds-inline-style-12)' }}>{cmd.label}</strong>
              </span>
              <span className="item-sub" style={{ marginLeft: 'var(--ds-inline-style-28-coll-2)' }}>{cmd.sub}</span>
            </Pressable>
          ))}
        </div>
      )}
      {showWikiMenu && menuCoords && (
        <div
          className="keep-autocomplete-menu"
          style={{ top: menuCoords.top, left: menuCoords.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <div style={{ padding: 'var(--ds-inline-style-6px-12px-4px)', fontSize: 'var(--ds-inline-style-9)', fontWeight: 'var(--ds-inline-style-700)', textTransform: 'uppercase', letterSpacing: 'var(--ds-inline-style-0-05em)', opacity: 'var(--ds-inline-style-0-5)' }}>Połącz notatkę</div>
          {filteredWikiNotes.length > 0 ? filteredWikiNotes.map((note, i) => (
            <Pressable
              key={note.id}
              type="button"
              className={`keep-autocomplete-item ${i === selectedMenuIndex ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); executeWikiLink(note); }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-inline-style-8-coll-3)' }}>
                <span style={{ fontSize: 'var(--ds-inline-style-14)', flexShrink: 0 }}>📎</span>
                <strong style={{ fontSize: 'var(--ds-inline-style-12)' }}>{note.title || '(Bez tytułu)'}</strong>
              </span>
            </Pressable>
          )) : (
            <div style={{ padding: 'var(--ds-inline-style-10px-12px)', fontSize: 'var(--ds-inline-style-11)', opacity: 'var(--ds-inline-style-0-5)' }}>Brak notatek dla "{wikiSearchQuery}"</div>
          )}
        </div>
      )}
      {/* CSS Placeholder fallback */}
      {(!value || value === '<br>' || value === '') && (
        <span className="absolute left-0 top-0 pointer-events-none text-text-muted opacity-[var(--opacity-50)] text-sm select-none">
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
      {/* Static always-visible formatting bar — extracted to RichEditorStaticBar */}
      <RichEditorStaticBar
        activeState={activeState}
        showStaticBar={showStaticBar}
        onAction={handleAction}
      />

    </div>
  );
}
