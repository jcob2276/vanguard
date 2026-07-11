#!/usr/bin/env node
// Backend contract ratchet — enforces docs/BACKEND_CONTRACT.md over supabase/functions/.
// Same philosophy as check-frontend-ratchets.mjs: debt may only shrink, never grow.
//
// Usage:
//   node scripts/ops/check-backend-contract.mjs                 -> check against baseline (CI)
//   node scripts/ops/check-backend-contract.mjs --write-baseline -> rewrite baseline to current counts
//
// Lower scripts/ops/backend-contract-baseline.json in the same commit as any cleanup that earns it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const baselinePath = path.join(root, "scripts", "ops", "backend-contract-baseline.json");
const functionsRoot = path.join(root, "supabase", "functions");

const MAX_LINES = 300;

// Kernel files allowed to own a given pattern. Everyone else importing/duplicating it is debt.
const KERNEL_CLIENT = ["supabase/functions/_shared/supabase.ts"];
const KERNEL_PROVIDER_FETCH = [
  "supabase/functions/_shared/deepseek.ts",
  "supabase/functions/_shared/openai.ts",
  "supabase/functions/_shared/infra/telegram/send.ts",
];
const KERNEL_SECRET = [
  "supabase/functions/_shared/supabase.ts",
  "supabase/functions/_shared/auth.ts",
];
// getWarsawDateString's own implementation lives in packages/domain; vanguardCore keeps a
// dependency-free private copy by design (documented in its header).
const DATE_ALLOWED = ["supabase/functions/_shared/vanguardCore.ts"];

const patternDefinitions = {
  patternCount_rawCreateClient: {
    label: "createClient( outside _shared/supabase.ts",
    check: (rel, content) => {
      if (KERNEL_CLIENT.includes(rel)) return 0;
      return (content.match(/\bcreateClient\(/g) || []).length;
    },
  },
  patternCount_rawProviderFetch: {
    label: "raw fetch to api.telegram/api.openai/api.deepseek outside _shared infra",
    check: (rel, content) => {
      if (KERNEL_PROVIDER_FETCH.includes(rel)) return 0;
      return (content.match(/fetch\(\s*[`'"]https:\/\/api\.(telegram|openai|deepseek)\./g) || []).length;
    },
  },
  patternCount_inlineWarsawDate: {
    label: "inline toLocaleDateString(...Europe/Warsaw) instead of @vanguard/domain helpers",
    check: (rel, content) => {
      if (DATE_ALLOWED.includes(rel)) return 0;
      return (content.match(/toLocaleDateString\(/g) || []).length;
    },
  },
  patternCount_asAnyFunctions: {
    label: "as any casts in supabase/functions/",
    check: (_rel, content) => (content.match(/\bas\s+any\b/g) || []).length,
  },
  patternCount_rawJsonResponse: {
    label: "hand-rolled new Response(JSON.stringify(...)) instead of jsonResponse helper",
    check: (_rel, content) => (content.match(/new Response\(JSON\.stringify/g) || []).length,
  },
  patternCount_secretKeyOutsideKernel: {
    label: "SB_SECRET_KEY/SERVICE_ROLE_KEY env reads outside _shared/supabase.ts & auth.ts",
    check: (rel, content) => {
      if (KERNEL_SECRET.includes(rel)) return 0;
      return (content.match(/Deno\.env\.get\(["'](SB_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)["']\)/g) || []).length;
    },
  },
};

function walk(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") list = list.concat(walk(filePath));
    } else if (/\.ts$/.test(file) && !/\.test\.ts$/.test(file)) {
      list.push(filePath);
    }
  }
  return list;
}

const allFiles = walk(functionsRoot);
const counts = Object.fromEntries(Object.keys(patternDefinitions).map((k) => [k, 0]));
const oversized = {};

for (const file of allFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  for (const [key, def] of Object.entries(patternDefinitions)) {
    counts[key] += def.check(rel, content);
  }
  const lines = content.split(/\r?\n/).length;
  if (lines > MAX_LINES) oversized[rel] = lines;
}

if (process.argv.includes("--write-baseline")) {
  const baseline = { ...counts, legacyLines: oversized };
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`Baseline written to ${path.relative(root, baselinePath)}`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("Missing scripts/ops/backend-contract-baseline.json — run with --write-baseline first.");
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

let failed = false;
console.log("Backend contract check (baseline: scripts/ops/backend-contract-baseline.json)\n");

for (const [key, def] of Object.entries(patternDefinitions)) {
  const current = counts[key];
  const limit = baseline[key] ?? 0;
  const ok = current <= limit;
  const arrow = current < limit ? " (shrunk — lower the baseline)" : "";
  console.log(`${ok ? "✓" : "✖"} ${def.label}: ${current} / baseline ${limit}${arrow}`);
  if (!ok) failed = true;
}

console.log("\nFile size limits (>300 lines is frozen legacy — may only shrink):");
const legacyBaseline = baseline.legacyLines ?? {};
let okCount = 0;
for (const [rel, lines] of Object.entries(oversized)) {
  const limit = legacyBaseline[rel];
  if (limit === undefined) {
    console.log(`✖ ${rel}: NEW oversized file (${lines} lines, max ${MAX_LINES}). Split it before merging.`);
    failed = true;
  } else if (lines > limit) {
    console.log(`✖ ${rel}: grew to ${lines} lines (limit ${limit}). Do not append to legacy files — extract a module.`);
    failed = true;
  } else if (lines < limit) {
    console.log(`✓ ${rel}: ${lines} / limit ${limit} (shrunk — lower the baseline)`);
  } else {
    okCount++;
  }
}
for (const rel of Object.keys(legacyBaseline)) {
  if (!(rel in oversized)) {
    console.log(`✓ ${rel}: below ${MAX_LINES} lines or deleted — remove from baseline.`);
  }
}
if (okCount > 0) console.log(`✓ ${okCount} legacy files exactly at baseline.`);

if (failed) {
  console.log("\nContract violated: a counter or legacy file grew past its baseline.");
  console.log("Undo the growth, or if deliberate, adjust the baseline in this commit and justify it. See docs/BACKEND_CONTRACT.md.");
  process.exit(1);
}
console.log("\nBackend contract holds — all counters within baseline.");
