/**
 * Read-only SQL tool used by the Oracle. Real safety boundary lives in the
 * `oracle_readonly_query` Postgres function (transaction_read_only, single
 * statement, 5s timeout, outer LIMIT 200) — this is just the calling
 * convention + audit trail.
 */
import { logAuditEvent } from "./audit.ts";

export async function runOracleReadonlyQuery(
  supabase: any,
  userId: string,
  sql: string,
): Promise<{ ok: true; rows: unknown[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("oracle_readonly_query", { query_text: sql });

  if (error) {
    await logAuditEvent({
      eventType: "oracle_sql_tool_call",
      severity: "warning",
      message: error.message,
      userId,
      metadata: { sql, success: false },
    });
    return { ok: false, error: error.message };
  }

  if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
    const errorMsg = (data as any).error as string;
    await logAuditEvent({
      eventType: "oracle_sql_tool_call",
      severity: "warning",
      message: errorMsg,
      userId,
      metadata: { sql, success: false },
    });
    return { ok: false, error: errorMsg };
  }

  await logAuditEvent({
    eventType: "oracle_sql_tool_call",
    severity: "info",
    message: "ok",
    userId,
    metadata: { sql, success: true, rowCount: Array.isArray(data) ? data.length : 0 },
  });
  return { ok: true, rows: Array.isArray(data) ? data : [] };
}
