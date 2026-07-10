import { useEffect } from 'react';

interface UseTodoKeyboardProps {
  setExpandedId: (id: string | null) => void;
  setContextMenu: (menu: null) => void;
}

export function useTodoKeyboard({ setExpandedId, setContextMenu }: UseTodoKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        if (e.key === 'Escape') {
          target.blur();
          setExpandedId(null);
          setContextMenu(null);
        }
        return;
      }

      if (e.key === 'n' || e.key === 'N' || e.key === '/') {
        e.preventDefault();
        const inputEl = document.querySelector('input[placeholder="Nowe zadanie..."]') as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
        }
      } else if (e.key === 'Escape') {
        setExpandedId(null);
        setContextMenu(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setExpandedId, setContextMenu]);
}
