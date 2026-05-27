/**
 * errorLogging.ts
 * 
 * Centralized error handling for critical paths.
 * Always logs important failures via audit + console.
 */

import { logAuditEvent } from "./audit.ts";

export async function logCriticalError(params: {
  area: string;                    // e.g. 'morning-brief', 'planning', 'reconciliation'
  error: unknown;
  message?: string;
  metadata?: Record<string, any>;
}) {
  const err = params.error instanceof Error ? params.error : new Error(String(params.error));
  
  console.error(`[${params.area}] CRITICAL ERROR:`, err.message, params.metadata || '');

  try {
    await logAuditEvent({
      eventType: 'critical_error',
      severity: 'error',
      message: params.message || `Critical error in ${params.area}`,
      metadata: {
        area: params.area,
        error_message: err.message,
        stack: err.stack?.substring(0, 800),
        ... (params.metadata || {}),
      },
    });
  } catch (auditErr) {
    console.error(`[${params.area}] Failed to write audit log for critical error:`, auditErr);
  }
}

/**
 * Wrapper for async operations in cron/handler contexts.
 * Logs failures properly instead of silent continue.
 */
export async function safeCritical<T>(
  area: string,
  fn: () => Promise<T>,
  options?: { fallback?: T; logOnError?: boolean }
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (options?.logOnError !== false) {
      await logCriticalError({ area, error: err });
    }
    return options?.fallback;
  }
}
