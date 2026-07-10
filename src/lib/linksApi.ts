import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapList } from './supabaseUtils';
import { NETWORK_TIMEOUT_MS, TIMEOUTS } from './constants';
import { invokeEdge } from './supabase';

export interface SavedLink {
  id: string;
  url: string;
  title: string;
  description: string;
  takeaways: string[];
  notes: string;
  category: string;
  domain: string;
  status: 'unread' | 'read';
  created_at: string;
  thumbnail_url?: string;
  channel_name?: string;
}

export interface TriageSuggestion {
  id: string;
  action: 'keep' | 'archive' | 'todo';
  category: string;
  takeaways: string[];
  reasoning: string;
}

export async function fetchLinks(supabase: SupabaseClient, userId: string): Promise<SavedLink[]> {
  const data = unwrapList(
    await supabase
      .from('vanguard_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  );
  return data as SavedLink[];
}

export async function saveSharedLink(
  actualUrl: string
): Promise<void> {
  await invokeEdge('vanguard-capture', {
    body: { content: actualUrl, source: 'share_target' },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
}

export async function addNewLink(
  url: string
): Promise<void> {
  await invokeEdge('vanguard-capture', {
    body: { content: url, source: 'user_input' },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
}

export async function fetchTriageSuggestions(
  userId: string
): Promise<TriageSuggestion[]> {
  const data = await invokeEdge<{ suggestions?: TriageSuggestion[] }>('vanguard-keep-triage', {
    body: { user_id: userId },
    signal: AbortSignal.timeout(TIMEOUTS.default),
  });
  return data?.suggestions || [];
}

export async function updateLinkTriage(
  supabase: SupabaseClient,
  id: string,
  updates: {
    status?: 'unread' | 'read';
    category?: string;
    takeaways?: string[];
  }
): Promise<void> {
  const { error } = await supabase
    .from('vanguard_links')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function updateLinkNotes(
  supabase: SupabaseClient,
  id: string,
  notes: string,
  status?: 'unread' | 'read'
): Promise<void> {
  const updates: Record<string, unknown> = { notes };
  if (status) updates.status = status;
  const { error } = await supabase
    .from('vanguard_links')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLink(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('vanguard_links')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
