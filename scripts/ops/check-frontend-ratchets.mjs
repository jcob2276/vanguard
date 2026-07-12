#!/usr/bin/env node
// Fails CI if any frontend debt tracker grows past its recorded baseline.
// Trackers: the named exception arrays in eslint.config.js (docs/FRONTEND_GUIDE.md §6)
// plus the --max-warnings threshold in package.json's "lint" script.
// plus the line counts of legacy files in scripts/ops/legacy-lines-baseline.json.
// plus pattern counters in src/ files.
//
// This does not enforce the debt shrinks — only that it doesn't silently grow.
// Lower scripts/ops/ratchet-baseline.json or scripts/ops/legacy-lines-baseline.json
// in the same commit as any cleanup that earns it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const eslintConfigPath = path.join(root, "eslint.config.js");
const packageJsonPath = path.join(root, "package.json");
const baselinePath = path.join(root, "scripts", "ops", "ratchet-baseline.json");
const legacyBaselinePath = path.join(root, "scripts", "ops", "legacy-lines-baseline.json");

const eslintSrc = fs.readFileSync(eslintConfigPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const legacyBaseline = JSON.parse(fs.readFileSync(legacyBaselinePath, "utf8"));

// Array-name trackers — everything in ratchet-baseline.json except maxWarnings maps to a
// `const NAME = [...]` in eslint.config.js. Exclude patternCount_* keys.
const arrayTrackers = Object.keys(baseline).filter(
  (k) => k !== "maxWarnings" && !k.startsWith("_") && !k.startsWith("patternCount_")
);

const results = [];

for (const name of arrayTrackers) {
  const re = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`);
  const match = eslintSrc.match(re);
  if (!match) {
    results.push({ name, ok: false, message: `not found in eslint.config.js — baseline entry is stale, remove it or fix the const name` });
    continue;
  }
  const current = (match[1].match(/'[^']+'/g) || []).length;
  const limit = baseline[name];
  results.push({ name, current, limit, ok: current <= limit });
}

// --max-warnings tracker — read straight from the "lint" script string.
{
  const lintScript = packageJson.scripts?.lint ?? "";
  const match = lintScript.match(/--max-warnings=(\d+)/);
  const current = match ? Number(match[1]) : null;
  const limit = baseline.maxWarnings;
  if (current === null) {
    results.push({ name: "maxWarnings", ok: false, message: `"lint" script in package.json has no --max-warnings=N flag` });
  } else {
    results.push({ name: "maxWarnings", current, limit, ok: current <= limit });
  }
}

// Pattern definitions and checks
const patternDefinitions = {
  patternCount_backgroundError: {
    label: "Background Errors in src/",
    check: (file, relativePath, content) => (content.match(/\[Background Error\]/g) || []).length,
  },
  patternCount_functionsV1: {
    label: "/functions/v1/ calls outside lib/supabase.ts",
    check: (file, relativePath, content) => {
      if (relativePath === "src/lib/supabase.ts") return 0;
      return (content.match(/\/functions\/v1\//g) || []).length;
    },
  },
  patternCount_setUTCDate: {
    label: "setUTCDate( in components/ & hooks/",
    check: (file, relativePath, content) => {
      if (!relativePath.startsWith("src/components/") && !relativePath.startsWith("src/hooks/")) return 0;
      return (content.match(/setUTCDate\(/g) || []).length;
    },
  },
  patternCount_toIsoStringSplitSlice: {
    label: "toISOString() split/slice date extraction in src/",
    check: (file, relativePath, content) => {
      const match1 = content.match(/toISOString\(\)\.slice\(0,\s*10\)/g) || [];
      const match2 = content.match(/toISOString\(\)\.split\(['"]T['"]\)\[0\]/g) || [];
      return match1.length + match2.length;
    },
  },
  patternCount_asAny: {
    label: "as any casts in src/",
    check: (file, relativePath, content) => (content.match(/\bas\s+any\b/g) || []).length,
  },
  patternCount_fixedInset: {
    label: "fixed inset-0 files in src/components/",
    check: (file, relativePath, content) => {
      if (!relativePath.startsWith("src/components/")) return 0;
      if (relativePath.includes("/hooks/")) return 0;
      return content.includes("fixed inset-0") ? 1 : 0;
    },
  },
  patternCount_sessionProp: {
    label: "session: Session prop declarations in src/components/",
    check: (file, relativePath, content) => {
      if (!relativePath.startsWith("src/components/")) return 0;
      if (relativePath.includes("/hooks/")) return 0;
      return (content.match(/\bsession\s*:\s*Session\b/g) || []).length;
    },
  },
};

// Recursive file walker for src/
function walk(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        list = list.concat(walk(filePath));
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        list.push(filePath);
      }
    }
  }
  return list;
}

const allFiles = walk(path.join(root, "src"));
const counts = {};
for (const key of Object.keys(patternDefinitions)) {
  counts[key] = 0;
}

for (const file of allFiles) {
  const relativePath = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  for (const [key, def] of Object.entries(patternDefinitions)) {
    const c = def.check(file, relativePath, content);
    if (c > 0 && key === "patternCount_asAny") {
      console.log(`[asAny match] ${relativePath} has ${c}`);
    }
    if (c > 0 && key === "patternCount_functionsV1") {
      console.log(`[functionsV1 match] ${relativePath} has ${c}`);
    }
    counts[key] += c;
  }
}

for (const [key, def] of Object.entries(patternDefinitions)) {
  const current = counts[key];
  const limit = baseline[key] ?? 0;
  results.push({
    name: `patternCount:${key}`,
    label: def.label,
    current,
    limit,
    ok: current <= limit,
  });
}

// Legacy lines count check
for (const [file, limit] of Object.entries(legacyBaseline)) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    results.push({
      name: `legacyLines:${file}`,
      ok: true,
      current: 0,
      limit,
      message: `File deleted or moved. Clean up eslint.config.js LEGACY_FILES and scripts/ops/legacy-lines-baseline.json.`,
    });
    continue;
  }
  const current = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
  results.push({
    name: `legacyLines:${file}`,
    current,
    limit,
    ok: current <= limit,
    message: `grew to ${current} lines (limit ${limit}). Do not append to legacy files! Extract your logic into a hook or subcomponent (docs/FRONTEND_GUIDE.md §9).`,
  });
}

let failed = false;
console.log("Frontend ratchet check (baseline: scripts/ops/ratchet-baseline.json & legacy-lines-baseline.json)\n");

const standardResults = results.filter(r => !r.name.startsWith("legacyLines:") && !r.name.startsWith("patternCount:"));
const patternResults = results.filter(r => r.name.startsWith("patternCount:"));
const legacyResults = results.filter(r => r.name.startsWith("legacyLines:"));

// Standard trackers
for (const r of standardResults) {
  if (r.message) {
    console.log(`✖ ${r.name}: ${r.message}`);
    failed = true;
    continue;
  }
  const arrow = r.current < r.limit ? " (shrunk — consider lowering the baseline)" : "";
  const status = r.ok ? "✓" : "✖";
  console.log(`${status} ${r.name}: ${r.current} / baseline ${r.limit}${arrow}`);
  if (!r.ok) failed = true;
}

// Pattern counters (PATTERN_COUNTERS)
if (patternResults.length > 0) {
  console.log("\nPattern counters:");
  for (const r of patternResults) {
    const arrow = r.current < r.limit ? " (shrunk — lower the baseline)" : "";
    const status = r.ok ? "✓" : "✖";
    console.log(`${status} ${r.label}: ${r.current} / baseline ${r.limit}${arrow}`);
    if (!r.ok) failed = true;
  }
}

// Legacy lines checks
if (legacyResults.length > 0) {
  console.log("\nLegacy file size limits:");
  let legacyOkCount = 0;
  let legacyShrunkCount = 0;

  for (const r of legacyResults) {
    const filename = r.name.slice("legacyLines:".length);
    if (!r.ok) {
      console.log(`✖ ${filename}: ${r.message}`);
      failed = true;
    } else if (r.current === 0 && r.limit > 0) {
      console.log(`✓ ${filename}: File deleted! Clean up config baseline. Limit was ${r.limit}.`);
      legacyShrunkCount++;
    } else if (r.current < r.limit) {
      console.log(`✓ ${filename}: ${r.current} / limit ${r.limit} (shrunk — consider lowering baseline)`);
      legacyShrunkCount++;
    } else {
      legacyOkCount++;
    }
  }

  if (legacyOkCount > 0) {
    console.log(`✓ ${legacyOkCount} files exactly at baseline limits.`);
  }
  if (legacyShrunkCount > 0) {
    console.log(`✓ ${legacyShrunkCount} files shrunk or deleted (consider lowering baseline).`);
  }
}

if (failed) {
  console.log("\nA tracker grew past its baseline. Either undo the growth, or if it's deliberate,\nlower/raise the baselines in this commit and explain why.");
  process.exit(1);
}

console.log("\nRunning Knip unused exports & files check...");
let knipOutput;
try {
  knipOutput = execSync("npx knip --reporter json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  knipOutput = err.stdout || "";
}

let knipFailed = false;
try {
  if (knipOutput.trim()) {
    const knipData = JSON.parse(knipOutput);
    const filesIssues = [];
    const exportsIssues = [];
    const typesIssues = [];

    if (knipData && Array.isArray(knipData.issues)) {
      for (const issue of knipData.issues) {
        if (Array.isArray(issue.files) && issue.files.length > 0) {
          for (const f of issue.files) {
            filesIssues.push(f.name);
          }
        }
        if (Array.isArray(issue.exports) && issue.exports.length > 0) {
          for (const exp of issue.exports) {
            exportsIssues.push(`${exp.name} (${issue.file}:${exp.line}:${exp.col})`);
          }
        }
        if (Array.isArray(issue.types) && issue.types.length > 0) {
          for (const t of issue.types) {
            typesIssues.push(`${t.name} (${issue.file}:${t.line}:${t.col})`);
          }
        }
      }
    }

    if (filesIssues.length > 0) {
      console.log("\n✖ Unused files found (must be deleted):");
      for (const f of filesIssues) console.log(`  - ${f}`);
      knipFailed = true;
    }
    if (exportsIssues.length > 0) {
      console.log("\n✖ Unused exports found (remove 'export' keyword or delete):");
      for (const exp of exportsIssues) console.log(`  - ${exp}`);
      knipFailed = true;
    }
    if (typesIssues.length > 0) {
      console.log("\n✖ Unused exported types/interfaces found (remove 'export' or delete):");
      for (const t of typesIssues) console.log(`  - ${t}`);
      knipFailed = true;
    }
  }
} catch (parseErr) {
  console.error("Warning: Failed to parse Knip JSON output:", parseErr);
}

if (!knipFailed) {
  console.log("✓ Knip dead code check: 0 issues found.");
} else {
  failed = true;
}

if (failed) {
  console.log("\nA tracker grew past its baseline or dead code was detected. Fix the issues before committing.");
  process.exit(1);
}

console.log("\nAll frontend debt trackers within baseline.");
