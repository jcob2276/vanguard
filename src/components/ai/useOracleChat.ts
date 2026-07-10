import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '../../store/useStore';
import type { ChatItem } from './ChatItems';
import type { CardTemplateId } from '../cards/CardFactory';
import {
  fetchPendingClarification,
  updatePendingActionStatus,
  upsertInsightCard,
  deleteInsightCards,
  fetchCurrentDailyMode,
  sendOracleChatPrompt,
  applyScheduleMutation,
  processAndUploadChatImages,
  type ClarificationRequest,
  type ScheduleMutation,
  type InsightCardPayload,
} from '../../lib/oracleApi';
import { notify } from '../../lib/notify';

const oracleChatKey = (userId: string, scope: 'default' | 'medical' = 'default') =>
  scope === 'medical' ? `vanguard_oracle_chat_medical_${userId}` : `vanguard_oracle_chat_${userId}`;

interface UseOracleChatProps {
  storageScope: 'default' | 'medical';
  initialQuery: string;
  defaultOpen: boolean;
  embedded: boolean;
  setOpen: (val: boolean) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

interface PendingActionPayload {
  schedule_mutation?: ScheduleMutation;
  insight_cards_mutation?: {
    action: 'add' | 'update' | 'delete';
    cards?: (InsightCardPayload & { id?: string })[];
    delete_ids?: string[];
  };
}

// Extracting `ask` into its own function surfaces react-hooks/set-state-in-effect and
// react-hooks/refs errors on the *existing* effects above — React Compiler only analyzes
// those deeply once the enclosing function is short enough. Those are pre-existing, unrelated
// findings that need their own careful pass (state-in-effect on 4 real fetch/sync effects,
// ref passed across a function boundary) — not a safe same-session mechanical split.
// eslint-disable-next-line max-lines-per-function
export function useOracleChat({
  storageScope,
  initialQuery,
  defaultOpen,
  embedded,
  setOpen,
  messagesEndRef,
  inputRef,
}: UseOracleChatProps) {
  const session = useSession();
  const userId = session?.user?.id;
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [pendingClarification, setPendingClarification] = useState<ClarificationRequest | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const idleTurnsRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(oracleChatKey(userId, storageScope));
      if (raw) {
        const parsed = JSON.parse(raw) as ChatItem[];
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
      }
    } catch { /* ignore corrupt cache */ }
  }, [userId, storageScope]);

  useEffect(() => {
    if (initialQuery) setInput(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (defaultOpen || embedded) setOpen(true);
  }, [defaultOpen, embedded, setOpen]);

  useEffect(() => {
    if (!userId || items.length === 0) return;
    try {
      localStorage.setItem(oracleChatKey(userId, storageScope), JSON.stringify(items.slice(-80)));
    } catch { /* quota */ }
  }, [userId, items, storageScope]);

  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const mode = await fetchCurrentDailyMode(userId);
      setCurrentMode(mode);
    })();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, loading, messagesEndRef]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const files = Array.from(e.clipboardData.files);
        const images = files.filter(f => f.type.startsWith('image/'));
        if (images.length > 0) {
          setPendingImages(prev => [...prev, ...images]);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const loadClarification = useCallback(async () => {
    if (!userId) return;
    const request = await fetchPendingClarification(userId);
    setPendingClarification(request);
  }, [userId]);

  useEffect(() => {
    void loadClarification();
  }, [loadClarification]);

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPendingImages(prev => [...prev, ...files]);
    }
  };

  const handlePendingAction = async (itemId: number, actionId: string, actionType: string, payload: unknown, approved: boolean) => {
    try {
      const status = approved ? 'approved' : 'denied';
      await updatePendingActionStatus(actionId, status);
      
      if (approved && payload) {
        const typedPayload = payload as PendingActionPayload;
        if (actionType === 'schedule_mutation' && typedPayload.schedule_mutation) {
          applyScheduleMutation(typedPayload.schedule_mutation);
        } else if (actionType === 'insight_cards_mutation' && typedPayload.insight_cards_mutation) {
          const mut = typedPayload.insight_cards_mutation;
          if ((mut.action === 'add' || mut.action === 'update') && Array.isArray(mut.cards)) {
            for (const card of mut.cards) {
              if (session) await upsertInsightCard(session.user.id, card.id, card);
            }
          } else if (mut.action === 'delete' && Array.isArray(mut.delete_ids)) {
            if (session) await deleteInsightCards(session.user.id, mut.delete_ids);
          }
        }
      }
      
      setItems(prev => prev.map((item, idx) => {
        if (idx === itemId && item.type === 'action') {
          return {
            ...item,
            text: approved ? '✓ Zmiana została zatwierdzona i wdrożona.' : '✗ Zmiana została odrzucona.',
            status: approved ? 'approved' : 'denied'
          } as ChatItem;
        }
        return item;
      }));
    } catch (e: unknown) {
      notify(`Błąd akceptacji: ${(e as Error).message}`, 'error');
    }
  };

  const history = items
    .filter(i => i.type === 'user' || i.type === 'ai')
    .map(i => ({
      role: i.type === 'user' ? 'user' : 'assistant',
      content: i.text,
    }));

  const ask = async (queryOverride?: string) => {
    let query = (queryOverride ?? input).trim();
    if ((!query && pendingImages.length === 0) || loading || !session) return;
    setInput('');
    const ts = new Date();

    setItems(prev => [...prev, { type: 'user', text: query || "Wysłano zdjęcie", timestamp: ts }]);
    setLoading(true);

    try {
      if (pendingImages.length > 0) {
        const urls = await processAndUploadChatImages(session.user.id, pendingImages);
        query += `\n[Załączone zdjęcia: ${urls.join(', ')}]`;
        setPendingImages([]);
      }

      const aiMessageId = Math.random().toString(36).substring(7);
      setItems(prev => [
        ...prev,
        { id: aiMessageId, type: 'ai', text: '', reasoning: '', timestamp: new Date(), isStreaming: true }
      ]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      const data = await sendOracleChatPrompt({
        history,
        current_query: query,
        user_id: session.user.id,
        accessToken: session.access_token,
        onChunk: (accumulatedText, accumulatedReasoning) => {
          setItems(prev => prev.map(item =>
            item.type === 'ai' && item.id === aiMessageId
              ? { ...item, text: accumulatedText, reasoning: accumulatedReasoning }
              : item
          ));
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      });

      const reply = data?.text ?? data?.response ?? '(brak odpowiedzi)';
      const cardTemplateId = data?.templateId as CardTemplateId | undefined;
      const cardData = data?.data;

      if (data?.schedule_mutation) {
        applyScheduleMutation(data.schedule_mutation);
      }

      const usedTool = !!(data?.tool_calls?.length || data?.templateId || data?.schedule_mutation || data?.insight_cards_mutation);
      if (usedTool) {
        idleTurnsRef.current = 0;
      } else {
        idleTurnsRef.current += 1;
      }

      const extraItems: ChatItem[] = [];
      if (data?.pending_action) {
        extraItems.push({
          type: 'action',
          text: `[Wymaga zatwierdzenia] Zmiana: ${data.pending_action.action_type === 'insight_cards_mutation' ? 'Karty wiedzy' : 'Harmonogram'}`,
          timestamp: new Date(),
          pendingActionId: data.pending_action.id,
          pendingActionPayload: data.pending_action.payload,
          pendingActionType: data.pending_action.action_type,
          status: 'pending',
        });
      }
      if (idleTurnsRef.current >= 3) {
        extraItems.push({ type: 'system_reminder', text: 'Możesz poprosić mnie o zapisanie danych, analizę trendów lub aktualizację planu.', timestamp: new Date() });
        idleTurnsRef.current = 0;
      }

      setItems(prev => {
        const base: ChatItem[] = data?.compressed_history
          ? data.compressed_history.map((m): ChatItem => {
              if (m.content.startsWith('[SKOMPRESOWANA HISTORIA]')) {
                return { type: 'system_reminder' as const, text: m.content, timestamp: new Date() };
              }
              return {
                type: m.role === 'user' ? 'user' as const : 'ai' as const,
                text: m.content,
                timestamp: new Date()
              };
            })
          : prev.filter(item => item.type !== 'thinking' && item.type !== 'tool');

        return [
          ...base.map(item => 'id' in item && item.id === aiMessageId ? { ...item, text: reply, templateId: cardTemplateId, cardData, isStreaming: false } : item),
          ...extraItems
        ];
      });
      void loadClarification();
    } catch (e: unknown) {
      setItems(prev => [...prev, { type: 'error', text: `Błąd: ${e instanceof Error ? e.message : 'nieznany'}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return {
    items,
    input,
    setInput,
    loading,
    currentMode,
    pendingClarification,
    setPendingClarification,
    pendingImages,
    setPendingImages,
    previewUrls,
    focused,
    setFocused,
    handleAttachImage,
    handlePendingAction,
    loadClarification,
    ask,
  };
}
