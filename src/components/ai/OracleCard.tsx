import { getTodayWarsaw } from '../../lib/date';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Sparkles, X, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gatherUserContext } from '../../lib/aiContext';
import { notify } from '../../lib/notify';
import type { Session } from '@supabase/supabase-js';
import { ClarificationRequestCard } from './ClarificationRequestCard';
import {
  ChatItem,
  TimeDivider,
  ThinkingItem,
  ToolCallItem,
  AiMessageItem,
  UserMessageItem,
  ErrorItem,
  SendActionMessage,
  SystemReminderItem,
  shouldShowTimeDivider,
} from './ChatItems';
import { CardFactory, type CardTemplateId } from '../cards/CardFactory';
import { sweepPastEventsInState } from '../../types/schedule';
import type { ScheduleViewData } from '../../types/schedule';
import { getAgentRunMode } from '../../types/agentRunMode';
import { getOracleUserConf } from './AgentSystemPromptHelper';
import exifr from 'exifr';

const SCHEDULE_KEY = 'vanguard_schedule_view';
const oracleChatKey = (userId: string, scope: 'default' | 'medical' = 'default') =>
  scope === 'medical' ? `vanguard_oracle_chat_medical_${userId}` : `vanguard_oracle_chat_${userId}`;

const MEDICAL_PROMPTS = [
  'Co warto badać / odświeżyć teraz — max 3 priorytety z moich danych',
  'Czego nie robić teraz (overtesting)?',
  'Co ma największe przełożenie operacyjne u mnie?',
];

export type OracleCardProps = {
  session: Session;
  embedded?: boolean;
  defaultOpen?: boolean;
  initialQuery?: string;
  storageScope?: 'default' | 'medical';
  suggestedPrompts?: string[];
  emptyHint?: string;
  collapsedTitle?: string;
  collapsedSubtitle?: string;
};

function applyScheduleMutation(mutation: any) {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    let state: ScheduleViewData = raw ? JSON.parse(raw) : null;
    if (!state) return;
    state = sweepPastEventsInState(state, new Date());

    const { action } = mutation;
    if (action === 'set_presentation') {
      if (mutation.hero) state = { ...state, hero: mutation.hero };
      if (mutation.editorial_intro) state = { ...state, editorialIntro: mutation.editorial_intro };
      if (mutation.quote_blocks) state = { ...state, quoteBlocks: mutation.quote_blocks };
    } else if (action === 'add_pending_item' && mutation.add_item) {
      const item = mutation.add_item;
      state = {
        ...state,
        timeline: state.timeline.map(day =>
          day.dayDate === item.dayDate
            ? { ...day, items: [...day.items, { id: item.id ?? crypto.randomUUID(), kind: item.kind ?? 'todo', title: item.title, startTime: item.startTime, pastAfter: item.pastAfter, done: false }] }
            : day
        ),
      };
    } else if (action === 'complete_pending_item' && mutation.complete_item_id) {
      state = {
        ...state,
        timeline: state.timeline.map(day => ({
          ...day,
          items: day.items.map(it =>
            it.id === mutation.complete_item_id ? { ...it, done: true } : it
          ),
        })),
      };
    }
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(state));
  } catch {}
}

interface ClarificationRequest {
  id: string;
  question: string;
  response_type: 'confirm' | 'single_choice' | 'multi_choice' | 'short_text';
  options: { id: string; label: string; value: string }[];
  proposed_memory?: string;
}

const PROMPTS_BY_MODE: Record<string, string[]> = {
  rescue: [
    'Jestem w trybie ratunkowym — co jest teraz najważniejsze?',
    'Skróć mój plan do 1 działania na dziś',
    'Co odcinam żeby przeżyć ten tydzień?',
    'Jak odblokować energię kiedy wszystko się wali?',
  ],
  minimal: [
    'Co zrobić żeby ten dzień był wygrany przy minimalnej energii?',
    'Jaki jest mój najważniejszy ruch przy niskiej energii?',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
  default: [
    'Jaki powinien być mój fokus dziś?',
    'Oceń mój tydzień i powiedz co poprawić',
    'Co mnie blokuje w tej chwili?',
    'Jak wygląda mój sen i recovery?',
  ],
};

export default function OracleCard({
  session,
  embedded = false,
  defaultOpen = false,
  initialQuery = '',
  storageScope = 'default',
  suggestedPrompts,
  emptyHint,
  collapsedTitle = 'Zapytaj o swój stan',
  collapsedSubtitle,
}: OracleCardProps) {
  const userId = session?.user?.id;
  const [open, setOpen] = useState(defaultOpen || embedded);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>('default');
  const [pendingClarification, setPendingClarification] = useState<ClarificationRequest | null>(null);
  const [btnPressed, setBtnPressed] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const idleTurnsRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  }, [defaultOpen, embedded]);

  useEffect(() => {
    if (!userId || items.length === 0) return;
    try {
      localStorage.setItem(oracleChatKey(userId, storageScope), JSON.stringify(items.slice(-80)));
    } catch { /* quota */ }
  }, [userId, items]);

  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  useEffect(() => {
    if (!userId) return;
    const today = getTodayWarsaw();
    supabase
      .from('daily_reconciliations')
      .select('planning_summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        const m = (data?.planning_summary as any)?.mode;
        if (m) setCurrentMode(m);
      });
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, loading]);

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

  const fetchPendingClarification = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('oracle_clarification_requests')
      .select('id, question, response_type, options, proposed_memory')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingClarification(data as ClarificationRequest | null);
  }, [userId]);

  useEffect(() => {
    fetchPendingClarification();
  }, [fetchPendingClarification]);

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPendingImages(prev => [...prev, ...files]);
    }
  };

  const handlePendingAction = async (itemId: number, actionId: string, actionType: string, payload: any, approved: boolean) => {
    try {
      const status = approved ? 'approved' : 'denied';
      const { error } = await supabase
        .from('oracle_pending_actions')
        .update({ status })
        .eq('id', actionId);
      if (error) throw error;
      
      if (approved) {
        if (actionType === 'schedule_mutation' && payload.schedule_mutation) {
          applyScheduleMutation(payload.schedule_mutation);
        } else if (actionType === 'insight_cards_mutation' && payload.insight_cards_mutation) {
          const mut = payload.insight_cards_mutation;
          if ((mut.action === 'add' || mut.action === 'update') && Array.isArray(mut.cards)) {
            for (const card of mut.cards) {
              const row = {
                user_id: session.user.id,
                template_id: card.template_id,
                title: card.title,
                insight: card.insight ?? null,
                widget_data: card.widget_data ?? {},
                tags: card.tags ?? [],
              };
              if (card.id) {
                await supabase.from('knowledge_insight_cards').upsert({ id: card.id, ...row });
              } else {
                await supabase.from('knowledge_insight_cards').insert(row);
              }
            }
          } else if (mut.action === 'delete' && Array.isArray(mut.delete_ids)) {
            await supabase.from('knowledge_insight_cards').delete().in('id', mut.delete_ids).eq('user_id', session.user.id);
          }
        }
      }
      
      setItems(prev => prev.map((item, idx) => {
        if (idx === itemId) {
          return {
            ...item,
            text: approved ? '✓ Zmiana została zatwierdzona i wdrożona.' : '✗ Zmiana została odrzucona.',
            status: approved ? 'approved' : 'denied'
          } as any;
        }
        return item;
      }));
    } catch (e: any) {
      notify(`Błąd akceptacji: ${e.message}`, 'error');
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
    if ((!query && pendingImages.length === 0) || loading) return;
    setInput('');
    const ts = new Date();
    
    setItems(prev => [...prev, { type: 'user', text: query || "Wysłano zdjęcie", timestamp: ts }]);
    setLoading(true);

    try {
      if (pendingImages.length > 0) {
        const urls: string[] = [];
        for (let i = 0; i < pendingImages.length; i++) {
          const file = pendingImages[i];
          let occurredDate = getTodayWarsaw();
            const tags = await exifr.parse(file);
            const dateObj = tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate;
            if (dateObj) {
              const d = new Date(dateObj);
              occurredDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            }
          
          const fileName = `${session.user.id}/${Date.now()}_chat_${i}.${file.name.split('.').pop()}`;
          await supabase.storage.from('progress-photos').upload(fileName, file);
          const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
          
          await supabase.from('progress_photos').insert({
            user_id: session.user.id,
            image_url: publicUrl,
            date: occurredDate
          });
          urls.push(publicUrl);
        }
        query += `\n[Załączone zdjęcia: ${urls.join(', ')}]`;
        setPendingImages([]);
      }

      const stateVector = await gatherUserContext(session);
      const { data, error } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          history: history,
          current_query: query,
          user_id: session.user.id,
          mode: 'chat',
          agent_run_mode: getAgentRunMode(),
          user_conf: getOracleUserConf() || undefined,
        },
      });
      if (error) throw error;
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
      
      const newItems: ChatItem[] = [{ type: 'ai', text: reply, timestamp: new Date(), templateId: cardTemplateId, cardData }];
      if (data?.pending_action) {
        newItems.push({
          type: 'action',
          text: `[Wymaga zatwierdzenia] Zmiana: ${data.pending_action.action_type === 'insight_cards_mutation' ? 'Karty wiedzy' : 'Harmonogram'}`,
          timestamp: new Date(),
          pendingActionId: data.pending_action.id,
          pendingActionPayload: data.pending_action.payload,
          pendingActionType: data.pending_action.action_type,
          status: 'pending',
        } as any);
      }
      if (idleTurnsRef.current >= 3) {
        newItems.push({ type: 'system_reminder', text: 'Możesz poprosić mnie o zapisanie danych, analizę trendów lub aktualizację planu.', timestamp: new Date() });
        idleTurnsRef.current = 0;
      }
      
      setItems(prev => {
        const base = data?.compressed_history 
          ? data.compressed_history.map((m: any) => {
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
          
        return [...base, ...newItems];
      });
      fetchPendingClarification();
    } catch (e: any) {
      setItems(prev => [...prev, { type: 'error', text: `Błąd: ${e.message ?? 'nieznany'}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleOpen = () => {
    setBtnPressed(true);
    setTimeout(() => {
      setBtnPressed(false);
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    }, 150);
  };

  const promptSuggestions =
    suggestedPrompts ??
    (storageScope === 'medical'
      ? MEDICAL_PROMPTS
      : (PROMPTS_BY_MODE[currentMode] ?? PROMPTS_BY_MODE.default));
  const emptyStateHint =
    emptyHint ??
    (storageScope === 'medical'
      ? 'Kontekst laboratoryjny + pełny state_vector. Priorytetyzacja retestów — bez diagnozy.'
      : 'Oracle ma dostęp do Twoich danych z ostatnich 48h.');

  return (
    <>
      {!open && !embedded ? (
        <button
          onClick={handleOpen}
          style={{ transform: btnPressed ? 'scale(0.9)' : 'scale(1)', transition: 'transform 150ms ease' }}
          className="flex w-full items-center gap-3 rounded-[24px] border border-primary/10 bg-primary/[0.04] p-4 text-left hover:bg-primary/[0.08] cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Oracle</p>
            <p className="text-[13px] font-black text-text-primary mt-0.5">{collapsedTitle}</p>
            {collapsedSubtitle && (
              <p className="text-[10px] text-text-muted mt-0.5">{collapsedSubtitle}</p>
            )}
          </div>
        </button>
      ) : open ? (
        <section
          ref={sectionRef}
          className="rounded-[24px] border border-primary/15 bg-surface backdrop-blur-md shadow-sm overflow-hidden"
          style={{
            animation: 'oracle-slide-up 500ms cubic-bezier(0.33, 1, 0.68, 1) both',
            transition: focused ? 'all 220ms ease-out' : 'all 0ms',
          }}
        >
          <style>{`
            @keyframes oracle-slide-up {
              from { opacity: 0; transform: translateY(24px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-custom">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                {storageScope === 'medical' ? 'Oracle · Badania' : 'Oracle'}
              </span>
            </div>
            {!embedded && (
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:bg-surface-solid hover:text-text-primary transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
            {items.length === 0 && (
              <div className="py-2 space-y-2">
                <p className="text-[10px] text-text-muted text-center mb-3">{emptyStateHint}</p>
                {promptSuggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="w-full text-left rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[11px] text-text-secondary hover:text-text-primary hover:border-primary/20 hover:bg-surface-solid transition-all cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {items.map((item, i) => {
              const prev = items[i - 1];
              const showDivider = prev && shouldShowTimeDivider(prev, item);
              return (
                <div key={i}>
                  {showDivider && <TimeDivider date={item.timestamp} />}
                  {item.type === 'user' && <UserMessageItem text={item.text} />}
                  {item.type === 'ai' && <AiMessageItem text={item.text} templateId={(item as any).templateId} cardData={(item as any).cardData} />}
                  {item.type === 'thinking' && <ThinkingItem item={item} />}
                  {item.type === 'tool' && <ToolCallItem item={item} />}
                  {item.type === 'error' && <ErrorItem text={item.text} />}
                  {item.type === 'action' && (
                    <div className="space-y-2 my-2 p-3 rounded-xl border border-primary/25 bg-primary/5">
                      <p className="text-[11px] font-bold text-primary">{item.text}</p>
                      {(item as any).status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePendingAction(i, (item as any).pendingActionId, (item as any).pendingActionType, (item as any).pendingActionPayload, true)}
                            className="rounded-lg bg-primary text-white px-3 py-1.5 text-[10px] font-bold hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
                          >
                            Zatwierdź
                          </button>
                          <button
                            onClick={() => handlePendingAction(i, (item as any).pendingActionId, (item as any).pendingActionType, (item as any).pendingActionPayload, false)}
                            className="rounded-lg bg-surface border border-border-custom text-text-secondary px-3 py-1.5 text-[10px] font-bold hover:bg-surface-solid active:scale-95 transition-all cursor-pointer"
                          >
                            Odrzuć
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {item.type === 'system_reminder' && <SystemReminderItem text={item.text} />}
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-border-custom bg-surface-solid px-4 py-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Clarification */}
          {pendingClarification && (
            <div className="px-4 pt-3">
              <ClarificationRequestCard
                request={pendingClarification}
                onAnswered={() => { setPendingClarification(null); fetchPendingClarification(); }}
              />
            </div>
          )}

          {/* Pending Images Preview */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 px-4 py-2 border-t border-border-custom bg-surface-solid/20">
              {pendingImages.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="relative h-10 w-10 rounded-lg overflow-hidden border border-border-custom group">
                  <img src={previewUrls[idx]} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-white cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border-custom px-4 py-3">
            <label className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-solid border border-border-custom text-text-secondary hover:text-text-primary active:scale-95 transition-all cursor-pointer">
              <Camera size={13} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAttachImage}
              />
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                storageScope === 'medical'
                  ? 'Co warto badać / odświeżyć u mnie teraz?'
                  : 'Jak wygląda mój sen w tym tygodniu?'
              }
              disabled={loading}
              className="flex-1 bg-transparent text-[16px] font-medium text-text-primary placeholder:text-text-muted/40 outline-none"
            />
            <button
              onClick={() => void ask()}
              disabled={(!input.trim() && pendingImages.length === 0) || loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-30 hover:bg-primary-hover transition-all active:scale-95 cursor-pointer"
            >
              <Send size={13} />
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
