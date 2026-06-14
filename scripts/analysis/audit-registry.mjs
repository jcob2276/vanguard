#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

const functionsDir = path.join(root, "supabase", "functions");
const readmePath = path.join(functionsDir, "README.md");
const deployNoJwtPath = path.join(root, "scripts", "ops", "deploy-no-jwt.ps1");
const smokeManifestPath = path.join(root, "scripts", "ops", "smoke-manifest.mjs");

const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function diff(left, right) {
  const r = new Set(right);
  return sorted(left.filter((item) => !r.has(item)));
}

const functionFolders = sorted(
  fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
    .filter((entry) => fs.existsSync(path.join(functionsDir, entry.name, "index.ts")))
    .map((entry) => entry.name),
);

const readme = read(readmePath);
const registryRows = new Map();
for (const line of readme.split(/\r?\n/)) {
  const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
  if (!match) continue;
  const [, name, status, trigger, jwt] = match;
  if (!fs.existsSync(path.join(functionsDir, name))) continue;
  registryRows.set(name, {
    status: status.replace(/\*\*/g, "").trim().toLowerCase(),
    trigger: trigger.trim(),
    jwt: jwt.replace(/\*\*/g, "").trim().toLowerCase(),
  });
}

const registered = sorted([...registryRows.keys()]);
const missingFromReadme = diff(functionFolders, registered);
const staleReadmeRows = diff(registered, functionFolders);
if (missingFromReadme.length) fail(`Missing README registry rows: ${missingFromReadme.join(", ")}`);
if (staleReadmeRows.length) fail(`README rows without function folders: ${staleReadmeRows.join(", ")}`);

const inventoryMatch = readme.match(/\*\*Inventory:\*\*\s*(\d+)\s+function folders/);
if (!inventoryMatch) {
  fail("README inventory line is missing or unparsable");
} else {
  const inventoryCount = Number(inventoryMatch[1]);
  if (inventoryCount !== functionFolders.length) {
    fail(`README inventory says ${inventoryCount}, actual function folders = ${functionFolders.length}`);
  }
}

const smoke = await import(pathToFileURL(smokeManifestPath).href);
const noVerify = sorted(smoke.NO_VERIFY_JWT_FUNCTIONS || []);
const smokeTargets = sorted((smoke.SMOKE_TARGETS || []).map((target) => target.name));
const removedCrons = new Set(smoke.CRON_REMOVED || []);
const migrationCrons = smoke.CRON_FROM_MIGRATIONS || [];

const deployScript = read(deployNoJwtPath);
const deployAllBlock = deployScript.match(/\$all\s*=\s*@\(([\s\S]*?)\)/);
if (!deployAllBlock) fail("deploy-no-jwt.ps1 is missing a parseable $all array");
const deployNoJwt = sorted([...((deployAllBlock?.[1] || "").matchAll(/"([^"]+)"/g))].map((match) => match[1]));

const activeNoJwtRegistry = sorted(
  [...registryRows.entries()]
    .filter(([, row]) => row.jwt === "false" && !row.status.includes("deprecated"))
    .map(([name]) => name),
);

const deprecatedNoJwtRegistry = sorted(
  [...registryRows.entries()]
    .filter(([, row]) => row.jwt === "false" && row.status.includes("deprecated"))
    .map(([name]) => name),
);

const missingFromNoVerify = diff(activeNoJwtRegistry, noVerify);
const extraNoVerify = diff(noVerify, activeNoJwtRegistry);
if (missingFromNoVerify.length) fail(`NO_VERIFY_JWT_FUNCTIONS missing active false-JWT functions: ${missingFromNoVerify.join(", ")}`);
if (extraNoVerify.length) fail(`NO_VERIFY_JWT_FUNCTIONS has non-active/deprecated/unknown functions: ${extraNoVerify.join(", ")}`);

const missingFromDeployNoJwt = diff(activeNoJwtRegistry, deployNoJwt);
const extraDeployNoJwt = diff(deployNoJwt, activeNoJwtRegistry);
if (missingFromDeployNoJwt.length) fail(`deploy-no-jwt.ps1 missing active false-JWT functions: ${missingFromDeployNoJwt.join(", ")}`);
if (extraDeployNoJwt.length) fail(`deploy-no-jwt.ps1 has non-active/deprecated/unknown functions: ${extraDeployNoJwt.join(", ")}`);

const smokeUnknown = diff(smokeTargets, registered);
if (smokeUnknown.length) fail(`SMOKE_TARGETS references functions missing from README/folders: ${smokeUnknown.join(", ")}`);

for (const name of deprecatedNoJwtRegistry) {
  const target = smoke.SMOKE_TARGETS.find((item) => item.name === name);
  if (!target) {
    warn(`Deprecated false-JWT function ${name} is not smoke-tested as a stub`);
  } else if (!target.expectStatus?.includes(410)) {
    fail(`Deprecated false-JWT function ${name} must have smoke expectStatus [410]`);
  }
}

for (const cron of migrationCrons) {
  if (!registryRows.has(cron.target.split(" ")[0])) {
    fail(`CRON_FROM_MIGRATIONS target is not a registered function: ${cron.jobname} -> ${cron.target}`);
  }
  if (removedCrons.has(cron.jobname)) {
    fail(`Cron ${cron.jobname} is both active in CRON_FROM_MIGRATIONS and removed in CRON_REMOVED`);
  }
}

for (const cronName of removedCrons) {
  if (migrationCrons.some((cron) => cron.jobname === cronName)) {
    fail(`Removed cron still listed as migration cron: ${cronName}`);
  }
}

if (warnings.length) {
  console.log("Registry audit warnings:");
  for (const message of warnings) console.log(`  WARN ${message}`);
  console.log("");
}

if (errors.length) {
  console.error("Registry audit failed:");
  for (const message of errors) console.error(`  FAIL ${message}`);
  process.exit(1);
}

console.log(`Registry audit OK: ${functionFolders.length} function folders, ${activeNoJwtRegistry.length} active false-JWT functions`);
