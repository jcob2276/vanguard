#!/usr/bin/env node
// Data contract checker — finds orphan tables (written but not read, or read but not written).
//
// Usage:
//   node scripts/ops/check-data-contracts.mjs         -> report only (CI safe, no baseline)
//   node scripts/ops/check-data-contracts.mjs --json   -> machine-readable output
//
// This script does NOT fail CI yet — it only reports. Switch to ratchet mode when orphan
// count drops to 0 or to named exceptions.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const functionsRoot = path.join(root, "supabase", "functions");

// ─── JSDoc parser (reused from generate-functions-registry.mjs pattern) ───

function parseJsDoc(content) {
  const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!docMatch) return { reads: [], writes: [] };

  const docBlock = docMatch[1];
  const getTag = (tag) => {
    const match = docBlock.match(new RegExp(`@${tag}\\s+(.+)`));
    return match ? match[1].trim() : "";
  };

  const parseTableList = (str) =>
    str
      .replace(/\([^)]*\)/g, "")  // strip ALL parenthetical content first
      .split(/[,;]/)
      .map((s) => s.trim().replace(/\s*poprzez.*$/i, ""))
      .filter((t) => t && t !== "—" && t !== "-");

  return {
    reads: parseTableList(getTag("reads")),
    writes: parseTableList(getTag("writes")),
  };
}

// ─── Actual DB access scanner (.from('table') + .select/.insert/.update/.upsert) ───

function scanActualAccess(content) {
  const reads = new Set();
  const writes = new Set();

  // Match .from('table') patterns
  const fromMatches = content.matchAll(/\.from\(['"](\w+)['"]\)/g);
  for (const m of fromMatches) {
    reads.add(m[1]); // Every .from() is at least a read
  }

  // Match .insert/.update/.upsert/.delete after .from() — these are writes
  // Simple heuristic: if file has .insert/.update/.upsert/.delete, mark tables as writable
  const writeOps = content.match(/\.(insert|update|upsert|delete)\(/g) || [];

  // More precise: find .from('table') followed by .insert/.update/.upsert/.delete
  // within a reasonable distance (same chain)
  const chainPattern = /\.from\(['"](\w+)['"]\)[\s\S]{0,200}\.(insert|update|upsert|delete)\(/g;
  for (const m of content.matchAll(chainPattern)) {
    writes.add(m[1]);
  }

  // Fallback: if file has write ops but we couldn't attribute them to specific tables,
  // mark ALL tables in the file as potentially writable (conservative)
  if (writeOps.length > 0 && writes.size === 0) {
    for (const t of reads) writes.add(t);
  }

  return { reads, writes };
}

// Tables accessed via _shared/ modules — not orphans even if no direct .from() in endpoint files.
const SHARED_MODULE_TABLES = new Set([
  "audit_events",       // written via _shared/audit.ts → logAuditEvent()
  "world_state",        // written via _shared/worldState.ts → saveWorldState()
]);

// ─── Walk ───

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

// ─── Main ───

const allFiles = walk(functionsRoot);

// table → { readers: Set<file>, writers: Set<file> }
const tableMap = new Map();

function ensureTable(name) {
  if (!tableMap.has(name)) {
    tableMap.set(name, { readers: new Set(), writers: new Set() });
  }
  return tableMap.get(name);
}

// JSDoc @reads/@writes is a per-FUNCTION convention documented once on that function's
// index.ts — it is meant to summarize the whole function, including its submodules
// (_handlers/, _commands/, oracle/*.ts, etc.), which don't carry their own headers.
// Comparing each submodule file against index.ts's header individually always "mismatches"
// by design; the meaningful comparison is index.ts's JSDoc vs the UNION of actual access
// across the whole function directory.
const functionAccess = new Map(); // functionName -> { reads: Set, writes: Set, indexRel: string|null, indexJsdoc }

function functionNameOf(rel) {
  // rel like "supabase/functions/<fn>/..." -> "<fn>"
  const parts = rel.split("/");
  return parts[2] ?? null;
}

for (const file of allFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  const isShared = rel.includes("_shared/");

  const actual = scanActualAccess(content);

  // Actual .from() tables count for orphan-detection regardless of whether the file is an
  // endpoint or a _shared/ library — a table read only from a _shared repo (e.g. entity_aliases
  // via _shared/nightly/graphInvariants.ts) is NOT an orphan just because no index.ts touches it.
  for (const t of actual.reads) ensureTable(t).readers.add(rel);
  for (const t of actual.writes) ensureTable(t).writers.add(rel);

  if (isShared) continue;

  const fn = functionNameOf(rel);
  if (!fn) continue;
  if (!functionAccess.has(fn)) {
    functionAccess.set(fn, { reads: new Set(), writes: new Set(), indexRel: null, indexJsdoc: null });
  }
  const entry = functionAccess.get(fn);
  for (const t of actual.reads) entry.reads.add(t);
  for (const t of actual.writes) entry.writes.add(t);

  const isIndex = rel === `supabase/functions/${fn}/index.ts`;
  if (isIndex) {
    const jsdoc = parseJsDoc(content);
    entry.indexRel = rel;
    entry.indexJsdoc = jsdoc;
    for (const t of jsdoc.reads) ensureTable(t).readers.add(rel);
    for (const t of jsdoc.writes) ensureTable(t).writers.add(rel);
  }
}

const jsdocVsActual = []; // functions where index.ts JSDoc misses tables actually touched anywhere in the function
for (const [_fn, entry] of functionAccess) {
  if (!entry.indexJsdoc) continue; // no index.ts found (shouldn't happen) — skip rather than false-flag
  const jsdocAll = new Set([...entry.indexJsdoc.reads, ...entry.indexJsdoc.writes]);
  const actualAll = new Set([...entry.reads, ...entry.writes]);
  const missingFromJsdoc = [...actualAll].filter((t) => !jsdocAll.has(t));
  if (missingFromJsdoc.length > 0) {
    jsdocVsActual.push({ file: entry.indexRel, missingInJsdoc: missingFromJsdoc });
  }
}

// ─── Orphan detection ───

const orphans = { writeOnly: [], readOnly: [] };

for (const [table, { readers, writers }] of tableMap) {
  if (SHARED_MODULE_TABLES.has(table)) continue; // known shared-module access
  if (writers.size > 0 && readers.size === 0) {
    orphans.writeOnly.push({ table, writers: [...writers] });
  }
  if (readers.size > 0 && writers.size === 0) {
    orphans.readOnly.push({ table, readers: [...readers] });
  }
}

// ─── Output ───

const jsonMode = process.argv.includes("--json");

if (jsonMode) {
  const functionAccessOut = Object.fromEntries(
    [...functionAccess.entries()].map(([fn, e]) => [
      fn,
      { reads: [...e.reads].sort(), writes: [...e.writes].sort(), indexRel: e.indexRel },
    ]),
  );
  console.log(JSON.stringify({ orphans, jsdocVsActual, functionAccess: functionAccessOut, totalTables: tableMap.size }, null, 2));
} else {
  console.log("Data contract check (supabase/functions/)\n");

  // JSDoc vs actual mismatches
  if (jsdocVsActual.length > 0) {
    console.log("JSDoc @reads/@writes vs actual .from() mismatches:\n");
    for (const { file, missingInJsdoc } of jsdocVsActual) {
      console.log(`  ✖ ${file}`);
      console.log(`    Missing from JSDoc: ${missingInJsdoc.join(", ")}`);
    }
    console.log("");
  }

  // Orphans
  const totalOrphans = orphans.writeOnly.length + orphans.readOnly.length;

  if (orphans.writeOnly.length > 0) {
    console.log("WRITE-ONLY tables (someone writes, nobody reads in edge functions):\n");
    for (const { table, writers } of orphans.writeOnly) {
      console.log(`  ${table}`);
      for (const w of writers) console.log(`    ← ${w}`);
    }
    console.log("");
  }

  if (orphans.readOnly.length > 0) {
    console.log("READ-ONLY tables (someone reads, nobody writes in edge functions):\n");
    for (const { table, readers } of orphans.readOnly) {
      console.log(`  ${table}`);
      for (const r of readers) console.log(`    → ${r}`);
    }
    console.log("");
  }

  // Summary
  console.log("---");
  console.log(`Tables tracked: ${tableMap.size}`);
  console.log(`Orphans found: ${totalOrphans} (${orphans.writeOnly.length} write-only, ${orphans.readOnly.length} read-only)`);

  if (totalOrphans === 0) {
    console.log("\nAll tables have both readers and writers in edge functions.");
  } else {
    console.log("\nNote: Some orphans may be false positives (tables accessed via raw SQL in");
    console.log("migrations, or tables used by frontend only). Verify before acting.");
  }
}
