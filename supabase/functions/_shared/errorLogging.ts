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
  let err: Error;
  let enrichedMetadata = { ... (params.metadata || {}) };

  if (params.error instanceof Error) {
    err = params.error;
  } else if (params.error && typeof params.error === 'object') {
    const obj = params.error as any;
    const msg = obj.message || obj.error_description || obj.error || JSON.stringify(obj);
    err = new Error(msg);
    if (obj.details || obj.hint || obj.code) {
      enrichedMetadata = {
        ...enrichedMetadata,
        db_error_details: obj.details,
        db_error_hint: obj.hint,
        db_error_code: obj.code,
      };
    }
  } else {
    err = new Error(String(params.error));
  }
  
  console.error(`[${params.area}] CRITICAL ERROR:`, err.message, enrichedMetadata);

  try {
    await logAuditEvent({
      eventType: 'critical_error',
      severity: 'error',
      message: params.message || `Critical error in ${params.area}`,
      metadata: {
        area: params.area,
        error_message: err.message,
        stack: err.stack?.substring(0, 800),
        ...enrichedMetadata,
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
