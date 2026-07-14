import { supabase, invokeEdgeStream } from './supabase';
import { getTodayWarsaw } from './date';
import { sweepPastEventsInState } from '../types/schedule';
import type { ScheduleViewData } from '../types/schedule';
import { getAgentRunMode } from '../types/agentRunMode';
import { getOracleUserConf } from './agentSystemPromptHelper';
import exifr from 'exifr';
import type { Json } from './database.types';

export interface ClarificationRequest {
  id: string;
  question: string;
  response_type: 'confirm' | 'single_choice' | 'multi_choice' | 'short_text';
  options: { id: string; label: string; value: string }[];
  proposed_memory?: string;
}

export type ScheduleMutation = {
  kind?: string;
  id?: string;
  title?: string;
  startTime?: string;
  pastAfter?: string;
  dayDate?: string;
  cardId?: string;
  description?: string;
  priority?: number;
  action?: string;
  hero?: {
    cardId: string;
    title: string;
    description?: string;
    startTime?: string;
    priority: number;
  };
  editorial_intro?: string;
  quote_blocks?: Array<{
    title: string;
    content: string;
    priority: 'low' | 'normal' | 'high';
  }>;
  add_item?: {
    id?: string;
    kind?: 'todo' | 'event';
    title: string;
    startTime?: string;
    pastAfter?: string;
    dayDate?: string;
  };
  complete_item_id?: string;
};

const SCHEDULE_KEY = 'vanguard_schedule_view';

export function applyScheduleMutation(mutation: ScheduleMutation) {
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
  } catch {
    // Ignore errors
  }
}

export async function fetchPendingClarification(userId: string): Promise<ClarificationRequest | null> {
  const { data, error } = await supabase
    .from('oracle_clarification_requests')
    .select('id, question, response_type, options, proposed_memory')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[oracleApi] fetchPendingClarification failed:', error.message);
    return null;
  }
  return data as ClarificationRequest | null;
}

export async function updatePendingActionStatus(actionId: string, status: 'approved' | 'denied'): Promise<void> {
  const { error } = await supabase
    .from('oracle_pending_actions')
    .update({ status })
    .eq('id', actionId);
  if (error) throw error;
}

async function insertProgressPhoto(userId: string, imageUrl: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('progress_photos')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      date,
    });
  if (error) throw error;
}

async function uploadProgressPhoto(fileName: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from('progress-photos').upload(fileName, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
  return publicUrl;
}

export interface InsightCardPayload {
  template_id: string;
  title: string;
  insight?: string | null;
  widget_data?: Json | null;
  tags?: string[] | null;
}

export async function upsertInsightCard(userId: string, cardId: string | undefined, card: InsightCardPayload): Promise<void> {
  const row = {
    user_id: userId,
    template_id: card.template_id,
    title: card.title,
    insight: card.insight ?? null,
    widget_data: card.widget_data ?? null,
    tags: card.tags ?? [],
  };
  if (cardId) {
    const { error } = await supabase.from('knowledge_insight_cards').upsert({ id: cardId, ...row });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('knowledge_insight_cards').insert(row);
    if (error) throw error;
  }
}

export async function deleteInsightCards(userId: string, deleteIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('knowledge_insight_cards')
    .delete()
    .in('id', deleteIds)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchCurrentDailyMode(userId: string): Promise<string> {
  const today = getTodayWarsaw();
  const { data, error } = await supabase
    .from('daily_reconciliations')
    .select('planning_summary')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.error('[oracleApi] fetchCurrentDailyMode failed:', error.message);
    return 'default';
  }
  const summary = data?.planning_summary as Record<string, unknown> | null;
  const mode = summary?.mode as string | undefined;
  return mode || 'default';
}

export interface OracleChatResponse {
  text?: string;
  response?: string;
  templateId?: string;
  data?: unknown;
  schedule_mutation?: ScheduleMutation;
  tool_calls?: unknown[];
  insight_cards_mutation?: {
    action: 'add' | 'update' | 'delete';
    cards?: (InsightCardPayload & { id?: string })[];
    delete_ids?: string[];
  };
  pending_action?: {
    action_type: string;
    id: string;
    payload: {
      schedule_mutation?: ScheduleMutation;
      insight_cards_mutation?: {
        action: 'add' | 'update' | 'delete';
        cards?: (InsightCardPayload & { id?: string })[];
        delete_ids?: string[];
      };
    };
  };
  compressed_history?: { role: string; content: string }[];
}

export interface OracleChatRequest {
  history: { role: string; content: string }[];
  current_query: string;
  user_id: string;
  accessToken: string;
  onChunk: (text: string, reasoning: string) => void;
}

export async function sendOracleChatPrompt({
  history,
  current_query,
  user_id,
  accessToken: _accessToken,
  onChunk,
}: OracleChatRequest): Promise<OracleChatResponse> {
  const response = await invokeEdgeStream('vanguard-oracle', {
    method: 'POST',
    body: {
      history,
      current_query,
      user_id,
      mode: 'chat',
      agent_run_mode: getAgentRunMode(),
      user_conf: getOracleUserConf() || undefined,
      stream: true
    }
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let accumulatedReasoning = "";
  let finalData: OracleChatResponse | null = null;

  if (reader) {
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.t) accumulatedText += parsed.t;
              if (parsed.r) accumulatedReasoning += parsed.r;
              if (parsed._final) finalData = parsed._final;
              
              onChunk(accumulatedText, accumulatedReasoning);
            } catch {
              // Ignore partial parsing errors
            }
          }
        }
      }
    }
  }

  return finalData || { text: accumulatedText };
}

export async function processAndUploadChatImages(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let occurredDate = getTodayWarsaw();
    const tags = await exifr.parse(file);
    const dateObj = tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate;
    if (dateObj) {
      const d = new Date(dateObj);
      const pad = (n: number) => String(n).padStart(2, '0');
      occurredDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    
    const fileName = `${userId}/${Date.now()}_chat_${i}.${file.name.split('.').pop()}`;
    const publicUrl = await uploadProgressPhoto(fileName, file);
    await insertProgressPhoto(userId, fileName, occurredDate);
    urls.push(publicUrl);
  }
  return urls;
}
