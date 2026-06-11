import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const functionsDir = join(process.cwd(), 'supabase', 'functions');
const files = readdirSync(functionsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(functionsDir, entry.name, 'index.ts'))
  .filter(file => existsSync(file))
  .sort();

if (files.length === 0) {
  console.error('No Supabase Edge Function entrypoints found.');
  process.exit(1);
}

const result = spawnSync('deno', ['check', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
