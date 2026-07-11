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
    } else if (/index\.ts$/.test(file) && !/\.test\.ts$/.test(file)) {
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

const jsdocVsActual = []; // files where JSDoc @writes differs from actual

for (const file of allFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");

  // Skip _shared files for orphan reporting (they're libraries, not endpoints)
  if (rel.includes("_shared/")) continue;

  const jsdoc = parseJsDoc(content);
  const actual = scanActualAccess(content);

  // JSDoc declared tables
  for (const t of jsdoc.reads) {
    ensureTable(t).readers.add(rel);
  }
  for (const t of jsdoc.writes) {
    ensureTable(t).writers.add(rel);
  }

  // Actual .from() tables (JSDoc might miss some)
  for (const t of actual.reads) {
    ensureTable(t).readers.add(rel);
  }
  for (const t of actual.writes) {
    ensureTable(t).writers.add(rel);
  }

  // Check for JSDoc vs actual mismatch
  const jsdocAll = new Set([...jsdoc.reads, ...jsdoc.writes]);
  const actualAll = new Set([...actual.reads, ...actual.writes]);
  const missingFromJsdoc = [...actualAll].filter((t) => !jsdocAll.has(t));
  if (missingFromJsdoc.length > 0) {
    jsdocVsActual.push({ file: rel, missingInJsdoc: missingFromJsdoc });
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
  console.log(JSON.stringify({ orphans, jsdocVsActual, totalTables: tableMap.size }, null, 2));
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
