/**
 * DEPRECATED: Career module data layer.
 *
 * The active project model is `projects`; active tasks live in `todo_*`.
 * These wrappers remain only for legacy data compatibility with the removed
 * Kariera screen. Do not add new product reads/writes here.
 * Every read filters by user_id. Every write throws on error (no silent swallow).
 * Momentum / last meaningful output / next move are DERIVED here in the frontend —
 * never stored. No AI classification, no Telegram in MVP.
 */
import { supabase } from './supabase';
import type { Database } from './database.types';

type CareerProjectRow = Database['public']['Tables']['career_projects']['Row'];
type CareerProjectInsert = Database['public']['Tables']['career_projects']['Insert'];
type CareerProjectUpdate = Database['public']['Tables']['career_projects']['Update'];

type CareerMoveRow = Database['public']['Tables']['career_moves']['Row'];
type CareerMoveInsert = Database['public']['Tables']['career_moves']['Insert'];

type CareerEvidenceRow = Database['public']['Tables']['career_evidence']['Row'];
type CareerEvidenceInsert = Database['public']['Tables']['career_evidence']['Insert'];

type CareerDecisionRow = Database['public']['Tables']['career_decisions']['Row'];
type CareerDecisionInsert = Database['public']['Tables']['career_decisions']['Insert'];

export const warsawToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

function unwrap<T>({ data, error }: { data: T | null; error: any }): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No data returned');
  return data;
}

function unwrapList<T>({ data, error }: { data: T[] | null; error: any }): T[] {
  if (error) throw new Error(error.message);
  return data || [];
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function listProjects(userId: string): Promise<CareerProjectRow[]> {
  return unwrapList(
    await supabase
      .from('career_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function createProject(userId: string, fields: Omit<CareerProjectInsert, 'user_id'>): Promise<CareerProjectRow> {
  return unwrap(
    await supabase
      .from('career_projects')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

export async function updateProject(id: string, patch: CareerProjectUpdate): Promise<CareerProjectRow> {
  return unwrap(
    await supabase.from('career_projects').update(patch).eq('id', id).select().single(),
  );
}

// ── Moves ─────────────────────────────────────────────────────────────────────
export async function listMoves(userId: string): Promise<CareerMoveRow[]> {
  return unwrapList(
    await supabase
      .from('career_moves')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function createMove(userId: string, fields: Omit<CareerMoveInsert, 'user_id'>): Promise<CareerMoveRow> {
  return unwrap(
    await supabase
      .from('career_moves')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

/**
 * Change a move's status. Sets completed_at when done (clears otherwise).
 * Marking a career move DONE drops one evidence row — a done career move is the
 * daily proof that the project actually moved. Never blocks the status update.
 */
export async function setMoveStatus(move: CareerMoveRow, status: string): Promise<CareerMoveRow> {
  const completed_at = status === 'done' ? new Date().toISOString() : null;
  const updated = unwrap(
    await supabase
      .from('career_moves')
      .update({ status, completed_at })
      .eq('id', move.id)
      .select()
      .single(),
  ) as CareerMoveRow;
  if (status === 'done' && move.status !== 'done') {
    try {
      await createEvidence(move.user_id, {
        project_id: move.project_id ?? null,
        move_id: move.id,
        type: 'manual',
        title: move.title,
        occurred_at: completed_at ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error('career evidence on done:', e);
    }
  }
  return updated;
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export async function listEvidence(userId: string, limit = 25): Promise<CareerEvidenceRow[]> {
  return unwrapList(
    await supabase
      .from('career_evidence')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit),
  );
}

export async function createEvidence(userId: string, fields: Omit<CareerEvidenceInsert, 'user_id'>): Promise<CareerEvidenceRow> {
  return unwrap(
    await supabase
      .from('career_evidence')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

// ── Decisions ─────────────────────────────────────────────────────────────────
export async function listDecisions(userId: string): Promise<CareerDecisionRow[]> {
  return unwrapList(
    await supabase
      .from('career_decisions')
      .select('*')
      .eq('user_id', userId)
      .order('decided_at', { ascending: false }),
  );
}

export async function createDecision(userId: string, fields: Omit<CareerDecisionInsert, 'user_id'>): Promise<CareerDecisionRow> {
  return unwrap(
    await supabase
      .from('career_decisions')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

// ── Derived (frontend-only; nothing persisted) ────────────────────────────────
/** Next move = earliest planned, still-open move (todo/doing). */
export function deriveNextMove(moves: CareerMoveRow[]): CareerMoveRow | null {
  const open = moves.filter((m) => m.status === 'todo' || m.status === 'doing');
  if (!open.length) return null;
  return [...open].sort((a, b) => {
    const ap = a.planned_for || '9999-12-31';
    const bp = b.planned_for || '9999-12-31';
    if (ap !== bp) return ap < bp ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

/** Per-project counts + last meaningful output (latest evidence timestamp). */
export function projectStats(
  project: CareerProjectRow,
  moves: CareerMoveRow[],
  evidence: CareerEvidenceRow[]
): { open: number; done: number; lastEvidenceAt: string | null } {
  const pm = moves.filter((m) => m.project_id === project.id);
  const open = pm.filter((m) => m.status === 'todo' || m.status === 'doing').length;
  const done = pm.filter((m) => m.status === 'done').length;
  const lastEv = evidence
    .filter((e) => e.project_id === project.id)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];
  return { open, done, lastEvidenceAt: lastEv ? lastEv.occurred_at : null };
}
