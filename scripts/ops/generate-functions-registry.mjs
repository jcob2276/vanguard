#!/usr/bin/env node
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const functionsDir = join(process.cwd(), 'supabase', 'functions');
const registryPath = join(functionsDir, 'FUNCTIONS.md');

const entries = readdirSync(functionsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => entry.name)
  .sort();

const parsedFunctions = [];
const missingHeaders = [];

for (const name of entries) {
  const indexPath = join(functionsDir, name, 'index.ts');
  if (!existsSync(indexPath)) {
    continue;
  }

  const content = readFileSync(indexPath, 'utf-8');
  const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);

  if (!docMatch) {
    missingHeaders.push(name);
    continue;
  }

  const docBlock = docMatch[1];
  const getTag = (tag) => {
    const match = docBlock.match(new RegExp(`@${tag}\\s+(.+)`));
    return match ? match[1].trim() : '—';
  };

  const funcName = getTag('function');
  if (funcName === '—') {
    missingHeaders.push(name);
    continue;
  }

  parsedFunctions.push({
    folder: name,
    function: funcName,
    status: getTag('status'),
    trigger: getTag('trigger'),
    role: getTag('role'),
    reads: getTag('reads'),
    writes: getTag('writes'),
    calls: getTag('calls'),
    consumer: getTag('consumer'),
  });
}

if (missingHeaders.length > 0) {
  console.warn(`⚠️ Warning: Missing or invalid JSDoc headers in functions:\n${missingHeaders.map(f => `  - ${f}`).join('\n')}\n`);
}

// Generate the markdown table content
let md = `# Mapa Edge Functions Vanguard\n\n`;
md += `Ten plik jest generowany automatycznie i opisuje mapę domenową, triggery oraz statusy wszystkich **${parsedFunctions.length} aktywnych Edge Functions** w monorepo.\n\n`;
md += `## Skaner Domenowy (Główna Mapa)\n\n`;
md += `| Funkcja | Status | Trigger / Wyzwalacz | Rola | DB Odczyt (\`@reads\`) | DB Zapis (\`@writes\`) | Konsument |\n`;
md += `|---|---|---|---|---|---|---|\n`;

for (const f of parsedFunctions) {
  const link = `[\`${f.function}\`](./${f.folder}/index.ts)`;
  md += `| ${link} | **${f.status}** | ${f.trigger} | ${f.role} | \`${f.reads}\` | \`${f.writes}\` | ${f.consumer} |\n`;
}

export function getGeneratedRegistry() {
  return md;
}

// Run directly if script is executed
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('generate-functions-registry.mjs') ||
  process.argv[1].endsWith('generate-functions-registry')
);

if (isDirectRun) {
  writeFileSync(registryPath, md, 'utf-8');
  console.log(`✅ Successfully generated ${registryPath} (${parsedFunctions.length} functions registered)`);
}
