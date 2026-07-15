import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir) {
  let list = [];
  for (const f of readdirSync(dir)) {
    const fp = join(dir, f);
    if (statSync(fp).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') list = list.concat(walk(fp));
    } else if (/\.(ts|tsx|css)$/.test(f)) list.push(fp);
  }
  return list;
}

// Safe replacements: legacy token → replacement string
const replacements = {
  '--legacy-color-046': 'white',
  '--legacy-color-047': 'white',
  '--legacy-color-001': 'var(--scrim)',
  '--legacy-color-038': 'var(--color-danger)',
  '--legacy-color-004': 'var(--color-success)',
  '--legacy-color-020': 'var(--color-info)',
  '--legacy-color-040': 'var(--color-warning)',
  '--legacy-color-010': 'var(--color-success)',
  '--legacy-color-019': 'var(--color-info)',
  '--legacy-color-029': 'var(--color-info-hover)',
};

const files = walk('src');
let totalReplacements = 0;

for (const f of files) {
  let content = readFileSync(f, 'utf8');
  let changed = false;
  for (const [legacy, replacement] of Object.entries(replacements)) {
    const escaped = legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, replacement);
      totalReplacements += matches.length;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(f, content);
    console.log('Updated: ' + f);
  }
}
console.log('Total replacements: ' + totalReplacements);

// Now remove the definitions from index.css
const cssPath = 'src/index.css';
let css = readFileSync(cssPath, 'utf8');
let removed = 0;
for (const legacy of Object.keys(replacements)) {
  const escaped = legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\s+${escaped}: [^;]+;\\n`, 'g');
  const before = css.length;
  css = css.replace(regex, '');
  if (css.length < before) removed++;
}
writeFileSync(cssPath, css);
console.log('Removed ' + removed + ' definitions from index.css');
