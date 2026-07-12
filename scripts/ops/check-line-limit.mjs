#!/usr/bin/env node
// Lint-staged guard: reject .ts files >300 lines in supabase/functions/.
// Run via: node scripts/ops/check-line-limit.mjs <file1> <file2> ...
//
// Exit 0 = all files OK, exit 1 = at least one file over limit.

const MAX_LINES = 300;
const EXEMPT = ["database.types.ts"];

let failed = false;

for (const file of process.argv.slice(2)) {
  if (!file.endsWith(".ts")) continue;
  // Only apply to backend edge functions
  if (!file.includes("supabase/functions/") && !file.includes("supabase\\functions\\")) continue;

  const exempt = EXEMPT.some((e) => file.endsWith(e));
  if (exempt) continue;

  try {
    const fs = require("fs");
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).length;
    if (lines > MAX_LINES) {
      console.error(`✖ ${file}: ${lines} lines (max ${MAX_LINES}). Extract a module to shrink it.`);
      failed = true;
    }
  } catch {
    // File may have been deleted by another staged change — skip
  }
}

if (failed) {
  console.error(`\nFile exceeds ${MAX_LINES} lines. Split it into smaller modules before committing.`);
  process.exit(1);
}
