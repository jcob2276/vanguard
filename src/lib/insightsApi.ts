import { supabase } from './supabase';

export interface BehavioralPattern {
  id: string;
  pattern_type: string;
  title: string | null;
  evidence_text: string;
  confidence: number;
  occurrence_count: number;
  status: string;
  last_seen: string | null;
}

export async function updatePatternStatus(patternId: string, newStatus: string): Promise<void> {
  const { error } = await supabase
    .from('vanguard_behavioral_patterns')
    .update({ status: newStatus })
    .eq('id', patternId);

  if (error) {
    console.error('[insightsApi] updatePatternStatus failed:', error.message);
    throw new Error(error.message);
  }
}
const STATUS_ORDER: Record<string, number> = {
  user_confirmed: 0,
  visible: 1,
  pending: 2,
  hypothesis: 2,
  user_rejected: 3,
  archived: 4,
};

export async function listActivePatterns(userId: string): Promise<BehavioralPattern[]> {
  const { data, error } = await supabase
    .from('vanguard_behavioral_patterns')
    .select('id, pattern_type, title, evidence_text, confidence, occurrence_count, status, last_seen')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[insightsApi] listActivePatterns failed:', error.message);
    throw new Error(error.message);
  }

  const mapped = (data ?? []).map(row => ({
    id: row.id,
    pattern_type: row.pattern_type,
    title: row.title,
    evidence_text: row.evidence_text ?? '',
    confidence: Number(row.confidence ?? 0),
    occurrence_count: row.occurrence_count ?? 0,
    status: row.status ?? 'pending',
    last_seen: row.last_seen ?? null,
  }));

  mapped.sort((a, b) => (STATUS_ORDER[a.status ?? 'pending'] ?? 9) - (STATUS_ORDER[b.status ?? 'pending'] ?? 9));
  return mapped;
}

export async function triggerPatternDetection(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('vanguard-nightly?action=detect-patterns', {
    body: { user_id: userId },
  });
  if (error) {
    console.error('[insightsApi] triggerPatternDetection failed:', error.message);
    throw new Error(error.message);
  }
}

export interface InsightCardData {
  id: string;
  templateId: string;
  title: string;
  insight?: string;
  widgetType?: string;
  widgetData: Record<string, unknown>;
  isPinned: boolean;
  sortOrder: number;
}

export async function fetchInsightCards(userId: string): Promise<InsightCardData[]> {
  const { data, error } = await supabase
    .from('knowledge_insight_cards')
    .select('*')
    .eq('user_id', userId)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[insightsApi] fetchInsightCards failed:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(row => ({
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    insight: row.insight ?? undefined,
    widgetType: (row as { widget_type?: string }).widget_type ?? undefined,
    widgetData: (row.widget_data as Record<string, unknown>) ?? {},
    isPinned: row.is_pinned ?? false,
    sortOrder: row.sort_order ?? 0,
  }));
}

export async function pinInsightCard(id: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('knowledge_insight_cards')
    .update({ is_pinned: isPinned })
    .eq('id', id);

  if (error) {
    console.error('[insightsApi] pinInsightCard failed:', error.message);
    throw new Error(error.message);
  }
}

export async function sortInsightCard(id: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('knowledge_insight_cards')
    .update({ sort_order: sortOrder })
    .eq('id', id);

  if (error) {
    console.error('[insightsApi] sortInsightCard failed:', error.message);
    throw new Error(error.message);
  }
}

export async function deleteInsightCard(id: string): Promise<void> {
  const { error } = await supabase
    .from('knowledge_insight_cards')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[insightsApi] deleteInsightCard failed:', error.message);
    throw new Error(error.message);
  }
}
