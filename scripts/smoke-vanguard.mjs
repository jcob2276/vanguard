#!/usr/bin/env node
/**
 * Post-deploy smoke: edge functions must not return 401 (verify_jwt mis-deploy).
 *
 * Default (safe): OPTIONS only — no Telegram, no LLM, no DB writes from crons.
 *
 * Usage:
 *   node scripts/smoke-vanguard.mjs
 *   node scripts/smoke-vanguard.mjs --with-service-role
 *   node scripts/smoke-vanguard.mjs --invoke-safe
 *   node scripts/smoke-vanguard.mjs --invoke-crons   # side effects possible
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: VANGUARD_CRON_SECRET (for save-daily-aggregate POST)
 * Optional: VANGUARD_USER_ID (oracle safe POST)
 *
 * Loads: .env.local, .env, supabase/.env (first found, does not override existing env)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PROJECT_REF,
  SMOKE_TARGETS,
} from "./ops/smoke-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = new Set(process.argv.slice(2));
const withServiceRole = args.has("--with-service-role");
const invokeSafe = args.has("--invoke-safe");
const invokeCrons = args.has("--invoke-crons");

if (args.has("--help") || args.has("-h")) {
  console.log(`smoke-vanguard.mjs [options]

Options:
  --with-service-role   Also test OPTIONS/POST with Authorization + apikey headers
  --invoke-safe         POST on endpoints marked post: safe (minimal body)
  --invoke-crons        POST on all cron targets (may send Telegram / run LLM)
  --help

Requires SUPABASE_URL (or defaults to project ${PROJECT_REF})
`);
  process.exit(0);
}

function loadEnvFiles() {
  for (const rel of [".env.local", ".env", "supabase/.env"]) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnvFiles();

const supabaseUrl =
  process.env.SUPABASE_URL?.replace(/\/$/, "") ||
  `https://${PROJECT_REF}.supabase.co`;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const cronSecret = process.env.VANGUARD_CRON_SECRET || "";
const vanguardUserId =
  process.env.VANGUARD_USER_ID || "165ae341-670c-46ce-82dc-434c4dbfcdfd";

function headers(mode) {
  const h = { "Content-Type": "application/json" };
  if (mode === "service_role" && serviceRole) {
    h.Authorization = `Bearer ${serviceRole}`;
    h.apikey = serviceRole;
  }
  if (mode === "cron_secret" && cronSecret) {
    h.Authorization = `Bearer ${cronSecret}`;
  }
  return h;
}

async function request(fn, method, mode, body) {
  const url = `${supabaseUrl}/functions/v1/${fn}`;
  const init = { method, headers: headers(mode) };
  if (body !== undefined && method !== "OPTIONS") {
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text().catch(() => "");
    return { status: res.status, text: text.slice(0, 200), error: null };
  } catch (err) {
    return { status: 0, text: String(err?.message || err), error: err };
  }
}

function resolveBody(target, body) {
  if (!body) return undefined;
  const raw = JSON.parse(
    JSON.stringify(body).replace(/__USER__/g, vanguardUserId),
  );
  return raw;
}

function shouldPost(target) {
  if (target.post === "skip") return false;
  if (target.post === "safe") return invokeSafe || invokeCrons;
  if (target.post === "cron" || target.post === "cron_secret" || target.post === "webhook") {
    return invokeCrons;
  }
  return false;
}

function postModes(target) {
  const modes = ["none"];
  if (withServiceRole && serviceRole) modes.push("service_role");
  if (target.post === "cron_secret" && cronSecret) modes.push("cron_secret");
  return [...new Set(modes)];
}

const results = { pass: 0, fail: 0, warn: 0 };

function record(name, phase, mode, status, note) {
  const expect = [200, 204, 410];
  const networkFail = status === 0;
  const ok =
    !networkFail &&
    status !== 401 &&
    (expect.includes(status) || (status >= 200 && status < 500));
  const icon = status === 401 ? "FAIL" : networkFail ? "NET " : ok ? " OK " : "WARN";
  if (status === 401) results.fail++;
  else if (networkFail) results.fail++;
  else if (ok) results.pass++;
  else results.warn++;
  console.log(
    `[${icon}] ${name.padEnd(32)} ${phase.padEnd(8)} auth=${mode.padEnd(14)} HTTP ${status}${note ? ` — ${note}` : ""}`,
  );
}

console.log(`\nVanguard smoke — ${supabaseUrl}`);
console.log(
  `Modes: OPTIONS${withServiceRole ? " + service_role" : ""}${invokeSafe ? " + invoke-safe POST" : ""}${invokeCrons ? " + invoke-crons POST" : ""}\n`,
);

if (!serviceRole && (withServiceRole || invokeSafe)) {
  console.warn("WARN: SUPABASE_SERVICE_ROLE_KEY not set — service_role tests skipped\n");
}

for (const target of SMOKE_TARGETS) {
  const authModes = ["none"];
  if (withServiceRole && serviceRole) authModes.push("service_role");

  for (const mode of authModes) {
    const { status, text } = await request(target.name, "OPTIONS", mode);
    record(target.name, "OPTIONS", mode, status, status === 401 ? "verify_jwt likely ON" : "");
  }

  if (!shouldPost(target)) continue;

  for (const mode of postModes(target)) {
    let body = resolveBody(target, target.body);
    if (target.post === "cron") body = body ?? {};
    if (target.post === "cron_secret" && mode === "cron_secret") {
      body = { userId: vanguardUserId };
    }
    if (target.post === "cron_secret" && mode !== "cron_secret" && !cronSecret) {
      continue;
    }

    const { status, text } = await request(target.name, "POST", mode, body);
    const expect = target.expectStatus;
    const note =
      expect && !expect.includes(status)
        ? `expected ${expect.join("|")}`
        : target.sideEffects;
    record(target.name, "POST", mode, status, note);
    if (status === 401 && text) console.log(`       ${text}`);
  }
}

console.log(`\nSummary: ${results.pass} ok, ${results.warn} warn, ${results.fail} fail (401)\n`);

if (results.fail > 0) {
  const hadNetwork = results.fail > 0 && !serviceRole;
  if (hadNetwork) {
    console.log("Tip: set SUPABASE_SERVICE_ROLE_KEY in .env for --with-service-role\n");
  }
  console.log("Fix 401: redeploy with --no-verify-jwt");
  console.log("See: scripts/ops/deploy-no-jwt.ps1  |  docs/runbooks/post-deploy-smoke.md\n");
  process.exit(1);
}

process.exit(results.warn > 0 ? 0 : 0);
