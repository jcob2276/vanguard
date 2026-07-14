import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getGeneratedRegistry } from './generate-functions-registry.mjs';

const functionsDir = join(process.cwd(), 'supabase', 'functions');
const files = readdirSync(functionsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => join(functionsDir, entry.name, 'index.ts'))
  .filter(file => existsSync(file))
  .sort();

if (files.length === 0) {
  console.error('No Supabase Edge Function entrypoints found.');
  process.exit(1);
}

// 1. Run type/compilation checks via Deno
console.log('Running deno check on edge functions...');
const checkResult = spawnSync('deno', ['check', '--import-map=supabase/functions/import_map.json', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (checkResult.status !== 0) {
  console.error('Deno compilation check failed.');
  process.exit(checkResult.status ?? 1);
}

// 2. Verify FUNCTIONS.md is in sync with codebase
console.log('\nVerifying FUNCTIONS.md registry is in sync...');
const registryPath = join(functionsDir, 'FUNCTIONS.md');
if (!existsSync(registryPath)) {
  console.error('❌ Security Violation: FUNCTIONS.md registry file is missing.');
  process.exit(1);
}

const currentRegistry = readFileSync(registryPath, 'utf-8');
const generatedRegistry = getGeneratedRegistry();

if (currentRegistry !== generatedRegistry) {
  console.error('❌ Registry Out of Sync: FUNCTIONS.md does not match JSDoc headers.');
  console.error('Please run "npm run registry:generate" to update the functions registry.');
  process.exit(1);
}
console.log('✅ FUNCTIONS.md is in sync.');

// 3. Parse config.toml to identify functions with verify_jwt = false
const configPath = join(process.cwd(), 'supabase', 'config.toml');
const configContent = readFileSync(configPath, 'utf-8');

const lines = configContent.split('\n');
let currentFunc = null;
let verifyJwt = true;
const functionsNoJwt = [];

for (const line of lines) {
  const funcMatch = line.match(/^\s*\[functions\.([\w-]+)\]\s*$/);
  if (funcMatch) {
    if (currentFunc && verifyJwt === false) {
      functionsNoJwt.push(currentFunc);
    }
    currentFunc = funcMatch[1];
    verifyJwt = true; // default
  } else {
    const jwtMatch = line.match(/^\s*verify_jwt\s*=\s*(true|false)\s*$/);
    if (jwtMatch && currentFunc) {
      verifyJwt = jwtMatch[1] === 'true';
    }
  }
}
if (currentFunc && verifyJwt === false) {
  functionsNoJwt.push(currentFunc);
}

console.log(`\nVerifying authorization checks for verify_jwt = false functions (${functionsNoJwt.length} found):`);

// 4. Statically verify each verify_jwt = false function entrypoint has authorization checks
let failed = false;
for (const fn of functionsNoJwt) {
  const indexPath = join(functionsDir, fn, 'index.ts');
  if (!existsSync(indexPath)) {
    console.error(`❌ Function '${fn}' defined in config.toml but missing index.ts entrypoint.`);
    failed = true;
    continue;
  }

  const content = readFileSync(indexPath, 'utf-8');
  // Comments are not authorization. A previous audit found an unauthenticated
  // webhook passing this guard solely because its comment mentioned
  // resolveUserScope, while the default request branch performed no check.
  const executableContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  // serveJson(handler, { auth: 'service' | 'user' }) enforces requireServiceRole/resolveUserScope
  // internally (see _shared/http.ts) — only `auth: 'none'` skips it, so a bare serveJson(handler)
  // call (defaults to 'user') still counts as authenticated. Conservatively scans the whole file
  // for an explicit auth:'none' rather than parsing nested parens around the serveJson(...) call.
  const hasExplicitNoneAuth = /auth:\s*['"]none['"]/.test(executableContent);
  const serveJsonAuthed = executableContent.includes('serveJson(') && !hasExplicitNoneAuth;
  const hasAuth =
    executableContent.includes('requireServiceRole') ||
    executableContent.includes('resolveUserScope') ||
    executableContent.includes('verifyTelegramSecret') ||
    executableContent.includes('MCP_SERVER_SECRET') ||
    serveJsonAuthed;

  if (!hasAuth) {
    console.error(`❌ Security Violation: Function '${fn}' has verify_jwt = false but lacks requireServiceRole, resolveUserScope, verifyTelegramSecret, or MCP_SERVER_SECRET check in its index.ts.`);
    failed = true;
  } else {
    console.log(`  [OK] ${fn}`);
  }
}

if (failed) {
  console.error('\nBackend authorization check failed. All verify_jwt = false functions must implement requireServiceRole, resolveUserScope or custom verification.');
  process.exit(1);
}

console.log('\nAll edge functions verify_jwt = false checks passed successfully.');
process.exit(0);
