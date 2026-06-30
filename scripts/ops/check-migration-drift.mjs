#!/usr/bin/env node
/**
 * Fails if any local migration file has no matching applied version on the
 * linked remote project, or vice versa (a migration applied directly against
 * remote that was never committed as a file).
 *
 * `supabase migration list --linked` prints a table with columns
 * "Local | Remote | Time (UTC)" — a blank Local or Remote cell on a row means
 * that version exists on only one side. This has been the root cause of
 * several production incidents in this repo (sprint_reviews, checkpoints_to_todo_items
 * migrations sat unapplied for days because nobody checked this table).
 *
 * Requires: SUPABASE_ACCESS_TOKEN env var (CI secret), project linked via
 * `supabase link --project-ref <ref>` or SUPABASE_PROJECT_REF env var.
 */
import { execSync } from "node:child_process";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "pdvqkgfsqziqlhptatgf";

try {
  execSync(`npx supabase link --project-ref ${PROJECT_REF}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  console.error("Failed to link Supabase project — is SUPABASE_ACCESS_TOKEN set?");
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
}

let output;
try {
  output = execSync(`npx supabase migration list --linked`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  console.error("Failed to run `supabase migration list`.");
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
}

const rows = output
  .split("\n")
  .map((line) => line.match(/^\s*(\S*)\s*\|\s*(\S*)\s*\|\s*(.*)$/))
  .filter((m) => m && /^\d{14}$/.test(m[1] || m[2] || ""));

const mismatched = rows.filter(([, local, remote]) => !local || !remote);

if (mismatched.length === 0) {
  console.log(`Migration ledger in sync: ${rows.length} versions match local <-> remote.`);
  process.exit(0);
}

console.error(`Migration drift detected — ${mismatched.length} version(s) exist on only one side:\n`);
for (const [, local, remote, time] of mismatched) {
  if (!remote) console.error(`  LOCAL ONLY (not applied to remote):  ${local}  (${time.trim()})`);
  if (!local) console.error(`  REMOTE ONLY (no local file):         ${remote}  (${time.trim()})`);
}
console.error(
  "\nApply pending local migrations to remote, or run `supabase migration repair` " +
  "to fix ledger bookkeeping for versions that were applied through a different tool.",
);
process.exit(1);
