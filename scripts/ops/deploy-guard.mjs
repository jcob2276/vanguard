#!/usr/bin/env node
// deploy-guard.mjs — Pre-flight checks before deploying edge functions.
//
// Usage:
//   node scripts/ops/deploy-guard.mjs                     -> deploy all functions
//   node scripts/ops/deploy-guard.mjs vanguard-nightly     -> deploy specific function(s)
//   node scripts/ops/deploy-guard.mjs --check-only         -> run checks without deploying
//
// Checks:
//   1. Clean git tree (no uncommitted changes)
//   2. Prompt change detection (warns about eval-runner)
//   3. Records git_sha to audit_events after successful deploy

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const projectRef = "pdvqkgfsqziqlhptatgf";

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

function fail(msg) {
  console.error(`\n✖ DEPLOY BLOCKED: ${msg}`);
  process.exit(1);
}

// ─── Check 1: Clean git tree ───

const status = run("git status --porcelain");
if (status) {
  console.error("Uncommitted changes found:\n");
  console.error(status);
  fail("Working tree must be clean before deploy. Commit or stash changes first.");
}
console.log("✓ Git tree is clean");

// ─── Check 2: Get current SHA ───

const sha = run("git rev-parse HEAD");
console.log(`✓ Current commit: ${sha.substring(0, 8)}`);

// ─── Check 3: Prompt change detection ───

const checkOnly = process.argv.includes("--check-only");
const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (targets.length > 0 || !checkOnly) {
  // Check if any staged/committed files contain prompt changes
  try {
    // No shell-level redirection (2>/dev/null, || echo '') — execSync spawns cmd.exe on
    // Windows by default and doesn't understand Unix shell syntax; the surrounding
    // try/catch already handles the "no previous commit" failure case.
    const diff = run("git diff HEAD~1 --name-only");
    if (diff) {
      const files = diff.split("\n").filter(Boolean);
      const promptFiles = files.filter(
        (f) =>
          f.endsWith(".ts") &&
          !f.includes("_shared/") &&
          existsSync(join(root, f))
      );

      let hasPromptChanges = false;
      for (const f of promptFiles) {
        const content = readFileSync(join(root, f), "utf8");
        if (
          content.includes("content:") &&
          (content.includes("deepseekChat") ||
            content.includes("systemPrompt") ||
            content.includes("Jestes Antigravity"))
        ) {
          console.log(`⚠ Prompt file changed: ${f}`);
          hasPromptChanges = true;
        }
      }

      if (hasPromptChanges) {
        console.log(
          "\n⚠ PROMPT CHANGES DETECTED: Run vanguard-eval-runner before deploying."
        );
        console.log(
          "  This is a WARNING, not a block — deploy will proceed.\n"
        );
      }
    }
  } catch {
    // git diff failed (e.g., no previous commit) — skip
  }
}

// ─── Deploy ───

if (checkOnly) {
  console.log("\n✓ Check-only mode — skipping deploy");
  process.exit(0);
}

const fnList = targets.length > 0 ? targets.join(" ") : "(all functions)";
console.log(`\nDeploying: ${fnList}`);

if (targets.length > 0) {
  // Do NOT force --no-verify-jwt here. config.toml's [functions.<name>] verify_jwt is the
  // declared source of truth (BACKEND_CONTRACT.md section 3) and the CLI reads it when no
  // flag overrides it. A blanket --no-verify-jwt silently flips verify_jwt=true functions to
  // false on the platform regardless of what's declared — found the hard way: this exact
  // bug turned analyze-food-quality's gateway JWT check off during a bulk deploy. It happened
  // to be harmless there (resolveUserScope enforces auth in-code too), but the script must
  // not rely on that being true for every function.
  for (const fn of targets) {
    console.log(`\n>> supabase functions deploy ${fn} --project-ref ${projectRef}`);
    execSync(
      `supabase functions deploy ${fn} --project-ref ${projectRef}`,
      { cwd: root, stdio: "inherit" }
    );
  }
} else {
  // Deploy all via existing PowerShell script
  console.log("\n>> Using deploy-no-jwt.ps1 for bulk deploy");
  execSync("powershell -ExecutionPolicy Bypass -File scripts/ops/deploy-no-jwt.ps1", {
    cwd: root,
    stdio: "inherit",
  });
}

// ─── Log deploy to audit_events ───

console.log("\n✓ Deploy complete. Recording to audit_events...");

// Written to a temp file + `--file` instead of an inline quoted argument — embedded
// newlines/quotes in the SQL broke shell quoting on Windows (cmd.exe splits on the
// newline mid-argument, producing "syntax error at end of input"). See lessons.md.
let sqlFile;
try {
  const serviceName = targets.length === 1 ? targets[0] : "bulk-deploy";
  const metadata = JSON.stringify({ git_sha: sha, functions: fnList }).replace(/'/g, "''");
  const message = `Edge function deployed: ${serviceName}`.replace(/'/g, "''");
  const sql = `INSERT INTO audit_events (event_type, severity, message, metadata) VALUES ('deploy', 'info', '${message}', '${metadata}'::jsonb);`;

  sqlFile = join(tmpdir(), `deploy-guard-${Date.now()}.sql`);
  writeFileSync(sqlFile, sql, "utf8");

  execSync(`supabase db query --linked -o json --file "${sqlFile}"`, {
    cwd: root,
    encoding: "utf8",
  });
  console.log(`✓ Deploy logged: sha=${sha.substring(0, 8)}, fn=${serviceName}`);
} catch (e) {
  console.warn(`⚠ Could not log deploy to audit_events: ${e.message}`);
} finally {
  if (sqlFile && existsSync(sqlFile)) unlinkSync(sqlFile);
}

console.log("\nDone. Run smoke test:");
console.log("  npm run smoke");
