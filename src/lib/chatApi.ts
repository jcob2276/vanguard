import { supabase, invokeEdge } from './supabase';
import type { CaptureResponse } from './edgeTypes';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export async function fetchChatMessages(limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[chatApi] Error fetching messages:', error);
    return [];
  }

  return (data || []).map((msg) => ({
    id: msg.id,
    role: (msg.role === 'user' || msg.role === 'assistant') ? msg.role : 'system',
    content: msg.content,
    created_at: msg.created_at || new Date().toISOString(),
  }));
}

export async function deleteChatMessage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_chat_messages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[chatApi] Error deleting message:', error);
    return false;
  }
  return true;
}

export async function sendOracleMessage(query: string): Promise<{ responseText: string }> {
  const res = await invokeEdge('vanguard-oracle', {
    body: {
      query,
      source: 'web_chat',
    },
  });

  const responseText = (res.response as string) || (res.text as string) || (res.message as string) || 'Odpowiedź przetworzona.';
  return { responseText };
}

export async function captureEntry(options: {
  content?: string;
  audioBlob?: Blob;
  source?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (options.audioBlob) {
    const formData = new FormData();
    const file = new File([options.audioBlob], 'voice-note.webm', { type: options.audioBlob.type || 'audio/webm' });
    formData.append('file', file);
    formData.append('source', options.source || 'quick_widget_voice');

    const res: CaptureResponse = await invokeEdge('vanguard-capture', {
      body: formData,
    });

    const isOk = 'ok' in res ? Boolean(res.ok) : Boolean(res.success);
    const transcriptText = 'transcript' in res ? res.transcript : ('message' in res ? res.message : undefined);

    return { ok: isOk, message: transcriptText || 'Nagranie przetworzone.' };
  }

  if (options.content?.trim()) {
    const res: CaptureResponse = await invokeEdge('vanguard-capture', {
      body: {
        content: options.content,
        source: options.source || 'quick_widget_text',
      },
    });

    const isOk = 'ok' in res ? Boolean(res.ok) : Boolean(res.success);
    return { ok: isOk, message: 'Wpis zapisany w streamie.' };
  }

  throw new Error('Brak treści do zapisania.');
}
