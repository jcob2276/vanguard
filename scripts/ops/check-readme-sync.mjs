#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const errors = [];

function fail(message) {
  errors.push(message);
}

function sorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function difference(left, right) {
  const rightSet = new Set(right);
  return sorted(left.filter((value) => !rightSet.has(value)));
}

function filesUnder(relativeDirectory, extensions) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return filesUnder(relativePath, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [relativePath] : [];
  });
}

function markedSection(markdown, name) {
  const start = `<!-- README_SYNC_${name}_START -->`;
  const end = `<!-- README_SYNC_${name}_END -->`;
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    fail(`README is missing a valid ${name} sync section`);
    return "";
  }
  return markdown.slice(startIndex + start.length, endIndex);
}

const readme = read("README.md");
const packageJson = JSON.parse(read("package.json"));

// Every local Markdown link must resolve from the repository root.
for (const match of readme.matchAll(/\[[^\]]+\]\(\.\/([^#)]+)(?:#[^)]+)?\)/g)) {
  if (!exists(match[1])) fail(`README local link does not exist: ./${match[1]}`);
}

// Every documented npm command must exist in package.json.
const documentedScripts = sorted(
  [...readme.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1]),
);
const packageScripts = Object.keys(packageJson.scripts);
for (const script of difference(documentedScripts, packageScripts)) {
  fail(`README references missing npm script: ${script}`);
}

// The route inventory must match App.tsx exactly, excluding only the wildcard.
const appSource = read("src/App.tsx");
const codeRoutes = sorted(
  [...appSource.matchAll(/<Route path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((route) => route !== "*"),
);
const routeSection = markedSection(readme, "ROUTES");
const documentedRoutes = sorted(
  [...routeSection.matchAll(/`(\/[^`]*)`/g)]
    .map((match) => match[1])
    .filter((route) => !route.includes(" ")),
);
for (const route of difference(codeRoutes, documentedRoutes)) {
  fail(`README route inventory is missing code route: ${route}`);
}
for (const route of difference(documentedRoutes, codeRoutes)) {
  fail(`README route inventory contains stale route: ${route}`);
}

// Frontend env inventory must match every import.meta.env.VITE_* reference.
const frontendEnvFromCode = sorted(
  filesUnder("src", [".ts", ".tsx"]).flatMap((file) =>
    [...read(file).matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)].map((match) => match[1])
  ),
);
const frontendEnvSection = markedSection(readme, "FRONTEND_ENV");
const frontendEnvFromReadme = sorted(
  [...frontendEnvSection.matchAll(/`(VITE_[A-Z0-9_]+)`/g)].map((match) => match[1]),
);
for (const variable of difference(frontendEnvFromCode, frontendEnvFromReadme)) {
  fail(`README frontend env inventory is missing code variable: ${variable}`);
}
for (const variable of difference(frontendEnvFromReadme, frontendEnvFromCode)) {
  fail(`README frontend env inventory contains unused variable: ${variable}`);
}

// Backend env inventory must match every explicit Deno.env.get("...") reference.
const backendEnvFromCode = sorted(
  filesUnder("supabase/functions", [".ts"]).flatMap((file) =>
    [...read(file).matchAll(/Deno\.env\.get\(["']([A-Z0-9_]+)["']\)/g)].map((match) => match[1])
  ),
);
const backendEnvSection = markedSection(readme, "BACKEND_ENV");
const backendEnvFromReadme = sorted(
  [...backendEnvSection.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((match) => match[1]),
);
for (const variable of difference(backendEnvFromCode, backendEnvFromReadme)) {
  fail(`README backend env inventory is missing code variable: ${variable}`);
}
for (const variable of difference(backendEnvFromReadme, backendEnvFromCode)) {
  fail(`README backend env inventory contains unused variable: ${variable}`);
}

// The example env file must cover every variable consumed by application runtime code.
const envExampleVariables = sorted(
  [...read(".env.example").matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]),
);
for (const variable of difference(
  [...frontendEnvFromCode, ...backendEnvFromCode],
  envExampleVariables,
)) {
  fail(`.env.example is missing runtime variable: ${variable}`);
}

// Edge Function names used as code identifiers in the canonical diagram must exist.
const functionFolders = sorted(
  fs.readdirSync(path.join(root, "supabase", "functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
    .filter((entry) => exists(path.join("supabase", "functions", entry.name, "index.ts")))
    .map((entry) => entry.name),
);
const functionSection = markedSection(readme, "FUNCTIONS");
const functionsFromReadme = sorted(
  [...functionSection.matchAll(/`([a-z][a-z0-9-]+)`/g)].map((match) => match[1]),
);
for (const functionName of difference(functionsFromReadme, functionFolders)) {
  fail(`README references missing Edge Function: ${functionName}`);
}

// Manual documentation may never copy the generated Edge Function count.
const manualRegistryDocs = [
  "README.md",
  "supabase/functions/README.md",
  "docs/ARCHITECTURE.md",
  "docs/BACKEND_CONTRACT.md",
];
for (const file of manualRegistryDocs) {
  const content = read(file);
  if (/\b\d+\s+(?:aktywnych\s+)?(?:Edge\s+)?[Ff]unctions?\b/.test(content) ||
      /\b\d+\s+funkcj(?:a|e|i)\s+edge\b/i.test(content)) {
    fail(`${file} hardcodes the generated Edge Function count`);
  }
}

if (errors.length) {
  console.error("README sync audit failed:");
  for (const error of errors) console.error(`  FAIL ${error}`);
  process.exit(1);
}

console.log(
  `README sync audit OK: ${codeRoutes.length} routes, ${documentedScripts.length} npm scripts, ` +
  `${frontendEnvFromCode.length} frontend env vars, ${backendEnvFromCode.length} backend env vars`,
);
