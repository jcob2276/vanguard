// One-off bug hunt: find string literals written to a column with a known
// CHECK (col = ANY (ARRAY[...])) constraint, where the literal isn't allowed.
// Scoped per-table: finds `.from('table')` then scans the following
// insert/update/upsert payload (brace-depth bounded) for `col: 'val'`.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TABLES = {
  audit_events: { severity: ['info', 'warning', 'error', 'critical'] },
  career_decisions: {
    decision_type: ['start', 'stop', 'continue', 'pause', 'pivot', 'commit', 'cut_scope', 'invest', 'avoid'],
    verdict: ['good', 'bad', 'mixed', 'too_early'],
  },
  career_evidence: { type: ['commit', 'deploy', 'note', 'metric', 'file', 'photo', 'health_data', 'conversation', 'test', 'manual'] },
  career_moves: {
    energy_cost: ['low', 'medium', 'high'],
    source: ['manual', 'suggestion', 'recurring', 'imported'],
    work_mode: ['deep', 'shallow', 'admin', 'recovery', 'physical', 'social'],
    value_type: ['leverage', 'stability', 'recovery'],
    status: ['todo', 'doing', 'done', 'blocked', 'dropped'],
  },
  career_projects: {
    review_cadence: ['weekly', 'biweekly', 'monthly', 'ad_hoc'],
    status: ['active', 'paused', 'archived'],
    risk_level: ['low', 'medium', 'high'],
    cost_level: ['low', 'medium', 'high'],
    sense_status: ['worth_it', 'questionable', 'paused', 'cut', 'completed'],
  },
  daily_reconciliations: {
    mode: ['full', 'checkin', 'morning_rescue', 'reflection'],
    status: ['sent', 'answered', 'missed'],
    planning_status: ['pending', 'active', 'completed'],
    midday_status: ['done', 'not_done', 'stuck'],
  },
  daily_strain: { readiness_level: ['primed', 'balanced', 'strained', 'rundown', 'insufficient'] },
  dreams: {
    life_goal: ['cialo', 'duch', 'konto'],
    category: ['finanse', 'ciało', 'relacje', 'doświadczenia', 'wolność', 'inne'],
  },
  friction_events: {
    confidence_source: ['self_report', 'inferred', 'biometric'],
    event_kind: ['friction_event', 'positive_micro_action', 'state_observation', 'micro_behavior_observation', 'reflection'],
    friction_type: ['avoidance', 'procrastination', 'emotional_spike', 'habit_break', 'social_withdrawal', 'sleep_disruption', 'training_drop', 'social_hesitation', 'communication_drift', 'self_control_break', 'positive_micro_action', 'other'],
    review_status: ['good', 'error', 'to_fix', 'dismissed', 'user_confirmed', 'user_corrected'],
    status: ['raw', 'reviewed', 'pattern_candidate', 'dismissed'],
  },
  goal_kpis: { pillar: ['cialo', 'duch', 'konto'] },
  life_goals: { bhag_pillar: ['cialo', 'duch', 'konto'] },
  project_checkpoints: { status: ['open', 'done', 'dropped'] },
  projects: { status: ['active', 'paused', 'done'] },
  strava_activities: { hr_source: ['strava', 'oura'] },
  todo_items: {
    ai_bucket: ['today', 'soon', 'later', 'future'],
    status: ['open', 'done', 'dropped'],
    priority: ['low', 'normal', 'high', 'urgent'],
    recurrence: ['daily', 'weekly', 'monthly'],
  },
  vanguard_behavioral_patterns: { status: ['pending', 'visible', 'user_confirmed', 'user_rejected', 'snoozed', 'archived'] },
  vanguard_entity_links: {
    status: ['active', 'historical', 'disputed', 'deprecated'],
    temporal_status: ['current', 'historical', 'declared', 'hypothesis', 'stale', 'unknown'],
    memory_type: ['fact', 'hypothesis', 'preference', 'correlation', 'telemetry'],
  },
  vanguard_eval_questions: { difficulty: ['easy', 'medium', 'hard', 'adversarial'] },
  vanguard_eval_runs: { status: ['running', 'completed', 'passed', 'failed', 'error'] },
  vanguard_raw_events: { processing_status: ['pending', 'processed', 'failed', 'ignored'] },
  vanguard_stream_closure_proposals: { status: ['pending', 'approved', 'rejected'] },
  vanguard_wiki_pages: {
    page_type: ['identity', 'behavior_pattern', 'person', 'project', 'training', 'health', 'decision', 'friction_loop', 'concept', 'source_summary', 'operating_model'],
    status: ['hypothesis', 'active', 'needs_review', 'user_confirmed', 'user_rejected', 'archived'],
  },
  vanguard_wiki_review_items: {
    severity: ['low', 'medium', 'high'],
    status: ['open', 'accepted', 'rejected', 'snoozed', 'resolved', 'archived'],
    item_type: ['contradiction', 'stale_claim', 'weak_evidence', 'missing_source', 'merge_candidate', 'confirmation_needed', 'deep_research'],
  },
  vanguard_wiki_runs: { status: ['success', 'partial', 'failed'] },
  vision_board_items: { type: ['affirmation', 'image', 'word'] },
};

const ROOTS = ['src', 'supabase/functions'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

// Given text and a start index right after `.from('table')`, find the next
// insert/update/upsert call and return its argument-object text (brace-depth
// bounded), or null if none found within a short lookahead window.
function extractPayload(text, fromEnd) {
  const lookahead = text.slice(fromEnd, fromEnd + 400);
  const callMatch = lookahead.match(/\.(insert|update|upsert)\s*\(/);
  if (!callMatch) return null;
  const callStart = fromEnd + callMatch.index + callMatch[0].length;
  let depth = 1;
  let i = callStart;
  while (i < text.length && depth > 0) {
    if (text[i] === '(' || text[i] === '{' || text[i] === '[') depth++;
    else if (text[i] === ')' || text[i] === '}' || text[i] === ']') depth--;
    i++;
  }
  return text.slice(callStart, i);
}

const files = ROOTS.flatMap((r) => walk(r));
const findings = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const table of Object.keys(TABLES)) {
    const fromRe = new RegExp(`\\.from\\(['"]${table}['"]\\)`, 'g');
    let fm;
    while ((fm = fromRe.exec(text))) {
      const payload = extractPayload(text, fm.index + fm[0].length);
      if (!payload) continue;
      for (const [col, allowed] of Object.entries(TABLES[table])) {
        const colRe = new RegExp(`\\b${col}\\s*:\\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]`, 'g');
        let cm;
        while ((cm = colRe.exec(payload))) {
          const val = cm[1];
          if (!allowed.includes(val)) {
            const globalIdx = fm.index + fm[0].length + payload.indexOf(cm[0]);
            const lineNo = text.slice(0, globalIdx).split('\n').length;
            findings.push({ file, line: lineNo, table, col, val });
          }
        }
      }
    }
  }
}

if (findings.length === 0) {
  console.log('No mismatches found.');
} else {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  ${f.table}.${f.col} = "${f.val}"  <-- not in allowed list`);
  }
  console.log(`\n${findings.length} finding(s).`);
}
