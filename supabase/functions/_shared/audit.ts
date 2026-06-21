import { createServiceClient } from "./supabase.ts";

let _auditClient: ReturnType<typeof createServiceClient> | null = null;
function getAuditClient() {
  if (!_auditClient) _auditClient = createServiceClient();
  return _auditClient;
}

/**
 * Prosty helper do logowania zdarzeń audytowych.
 * Używany do observability – zbierania informacji o degradacjach, błędach i ważnych zdarzeniach.
 *
 * Nie rzuca wyjątków – w razie błędu tylko loguje do konsoli.
 */
export async function logAuditEvent(params: {
  eventType: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  userId?: string;
  relatedTable?: string;
  relatedId?: string;
  metadata?: Record<string, any>;
}) {
  const supabase = getAuditClient();

  try {
    const { error } = await supabase.from('audit_events').insert({
      event_type: params.eventType,
      severity: params.severity || 'warning',
      message: params.message,
      user_id: params.userId || null,
      related_table: params.relatedTable || null,
      related_id: params.relatedId || null,
      metadata: params.metadata || {},
    });
    if (error) console.error('[audit] Insert failed:', error.message);
  } catch (err) {
    console.error('[audit] Failed to log event:', err);
  }
}
