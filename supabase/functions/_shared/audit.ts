import { createServiceClient } from "./supabase.ts";

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
  const supabase = createServiceClient();

  try {
    await supabase.from('audit_events').insert({
      event_type: params.eventType,
      severity: params.severity || 'warning',
      message: params.message,
      user_id: params.userId || null,
      related_table: params.relatedTable || null,
      related_id: params.relatedId || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Nie chcemy, żeby logging psuł główną logikę
    console.error('[audit] Failed to log event:', err);
  }
}
