/**
 * http.ts — Kernel for edge function HTTP handling.
 *
 * Provides `serveJson` which standardizes:
 * - CORS / OPTIONS handling
 * - Auth resolution (service-role, user token, or none)
 * - Automatic error logging to audit_events on unhandled exceptions
 * - Consistent JSON response framing
 *
 * Usage:
 *   import { serveJson } from '../_shared/http.ts';
 *   Deno.serve(serveJson(async (req, ctx) => {
 *     return { data: 'hello' };  // auto-wrapped in JSON Response
 *   }));
 */
import { corsHeadersFor, createServiceClient, resolveUserScope } from './supabase.ts';
import { requireServiceRole } from './auth.ts';
import { logCriticalError } from './errorLogging.ts';

export interface JsonCtx {
  userId: string | null;
  isServiceRole: boolean;
  supabase: ReturnType<typeof createServiceClient>;
}

type Handler = (req: Request, ctx: JsonCtx) => Promise<unknown>;

/**
 * Wraps a handler with standard HTTP concerns.
 *
 * @param handler  Async function receiving (req, ctx) and returning any JSON-serializable value.
 *                 The return value is automatically wrapped in a 200 JSON Response.
 *                 Throw to return an error (logged to audit_events automatically).
 * @param opts.auth  'user' (default) — resolve user token; 'service' — require service-role;
 *                   'none' — skip auth entirely.
 */
export function serveJson(
  handler: Handler,
  opts?: { auth?: 'service' | 'user' | 'none' },
) {
  const authMode = opts?.auth ?? 'user';

  return async (req: Request): Promise<Response> => {
    const cors = corsHeadersFor(req);

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      let userId: string | null = null;
      let isServiceRole = false;

      if (authMode === 'service') {
        const authError = requireServiceRole(req);
        if (authError) return authError;
        isServiceRole = true;
        const body = await req.clone().json().catch(() => ({}));
        userId = body.userId ?? null;
      } else if (authMode === 'user') {
        const body = await req.clone().json().catch(() => ({}));
        const scope = await resolveUserScope(req, body.userId ?? null);
        userId = scope.userId ?? null;
        isServiceRole = scope.isServiceRole;
      }
      // authMode === 'none': userId stays null, isServiceRole stays false

      const supabase = createServiceClient();
      const result = await handler(req, { userId, isServiceRole, supabase });

      return new Response(JSON.stringify(result), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const url = new URL(req.url);
      const fnName = url.pathname.split('/').pop() || 'unknown';

      console.error(`[${fnName}] error:`, err);

      await logCriticalError({
        area: fnName,
        error: err,
        message: `Edge function error in ${fnName}`,
        metadata: { method: req.method, url: req.url },
      }).catch(() => {}); // don't let audit failure mask the response

      const isAuthError = err instanceof Error && (
        err.message.includes('Unauthorized') ||
        err.message.includes('Missing Authorization') ||
        err.message.includes('Invalid user token')
      );
      const status = isAuthError ? 401 : 500;
      const message = err instanceof Error ? err.message : String(err);

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  };
}
