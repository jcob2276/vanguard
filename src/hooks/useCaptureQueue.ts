import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CaptureQueueItem =
  | { kind: 'link'; id: string; title: string; url: string }
  | { kind: 'todo'; id: string; title: string }
  | { kind: 'note'; id: string; title: string; snippet: string; content: string };

const MAX_ITEMS = 5;

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export function useCaptureQueue(userId: string | undefined) {
  const [items, setItems] = useState<CaptureQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const staleCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ data: links }, { data: todos }, { data: notes }] = await Promise.all([
          supabase
            .from('vanguard_links')
            .select('id, title, url')
            .eq('user_id', userId)
            .eq('status', 'unread')
            .order('created_at', { ascending: true })
            .limit(3),
          supabase
            .from('todo_items')
            .select('id, title')
            .eq('user_id', userId)
            .eq('status', 'open')
            .is('section_id', null)
            .is('due_date', null)
            .is('ai_bucket', null)
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('vanguard_notes')
            .select('id, title, content')
            .eq('user_id', userId)
            .eq('is_archived', false)
            .lt('updated_at', staleCutoff)
            .order('updated_at', { ascending: true })
            .limit(2),
        ]);

        if (cancelled) return;

        const merged: CaptureQueueItem[] = [];
        for (const link of links ?? []) {
          if (merged.length >= MAX_ITEMS) break;
          merged.push({
            kind: 'link',
            id: link.id,
            title: link.title || link.url,
            url: link.url,
          });
        }
        for (const todo of todos ?? []) {
          if (merged.length >= MAX_ITEMS) break;
          merged.push({ kind: 'todo', id: todo.id, title: todo.title });
        }
        for (const note of notes ?? []) {
          if (merged.length >= MAX_ITEMS) break;
          const plain = stripHtml(note.content || '');
          merged.push({
            kind: 'note',
            id: note.id,
            title: note.title || plain.slice(0, 40) || '(bez tytułu)',
            snippet: plain.slice(0, 120),
            content: note.content || '',
          });
        }
        setItems(merged);
      } catch (e) {
        console.error('[useCaptureQueue] fetch failed', e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, key]);

  return { items, loading, refresh, total: items.length };
}
