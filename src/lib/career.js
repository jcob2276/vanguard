/**
 * Career module data layer (MVP).
 *
 * Thin wrappers over the supabase client for the four career_* tables.
 * Every read filters by user_id. Every write throws on error (no silent swallow).
 * Momentum / last meaningful output / next move are DERIVED here in the frontend —
 * never stored. No AI classification, no Telegram in MVP.
 */
import { supabase } from './supabase';

export const warsawToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function listProjects(userId) {
  return unwrap(
    await supabase
      .from('career_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function createProject(userId, fields) {
  return unwrap(
    await supabase
      .from('career_projects')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

export async function updateProject(id, patch) {
  return unwrap(
    await supabase.from('career_projects').update(patch).eq('id', id).select().single(),
  );
}

// ── Moves ─────────────────────────────────────────────────────────────────────
export async function listMoves(userId) {
  return unwrap(
    await supabase
      .from('career_moves')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function createMove(userId, fields) {
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
export async function setMoveStatus(move, status) {
  const completed_at = status === 'done' ? new Date().toISOString() : null;
  const updated = unwrap(
    await supabase
      .from('career_moves')
      .update({ status, completed_at })
      .eq('id', move.id)
      .select()
      .single(),
  );
  if (status === 'done' && move.status !== 'done') {
    try {
      await createEvidence(move.user_id, {
        project_id: move.project_id ?? null,
        move_id: move.id,
        type: 'manual',
        title: move.title,
        occurred_at: completed_at,
      });
    } catch (e) {
      console.error('career evidence on done:', e);
    }
  }
  return updated;
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export async function listEvidence(userId, limit = 25) {
  return unwrap(
    await supabase
      .from('career_evidence')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit),
  );
}

export async function createEvidence(userId, fields) {
  return unwrap(
    await supabase
      .from('career_evidence')
      .insert({ user_id: userId, ...fields })
      .select()
      .single(),
  );
}

// ── Decisions ─────────────────────────────────────────────────────────────────
export async function listDecisions(userId) {
  return unwrap(
    await supabase
      .from('career_decisions')
      .select('*')
      .eq('user_id', userId)
      .order('decided_at', { ascending: false }),
  );
}

export async function createDecision(userId, fields) {
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
export function deriveNextMove(moves) {
  const open = moves.filter((m) => m.status === 'todo' || m.status === 'doing');
  if (!open.length) return null;
  return [...open].sort((a, b) => {
    const ap = a.planned_for || '9999-12-31';
    const bp = b.planned_for || '9999-12-31';
    if (ap !== bp) return ap < bp ? -1 : 1;
    return new Date(a.created_at) - new Date(b.created_at);
  })[0];
}

/** Per-project counts + last meaningful output (latest evidence timestamp). */
export function projectStats(project, moves, evidence) {
  const pm = moves.filter((m) => m.project_id === project.id);
  const open = pm.filter((m) => m.status === 'todo' || m.status === 'doing').length;
  const done = pm.filter((m) => m.status === 'done').length;
  const lastEv = evidence
    .filter((e) => e.project_id === project.id)
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0];
  return { open, done, lastEvidenceAt: lastEv ? lastEv.occurred_at : null };
}
