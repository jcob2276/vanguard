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

const files = walk('src');
let totalFixes = 0;

for (const f of files) {
  let content = readFileSync(f, 'utf8');
  const original = content;

  // Fix 1: var(var(--color-success)) → var(--color-success)
  // Fix 2: var(var(--color-info)) → var(--color-info)
  // Fix 3: var(var(--color-warning)) → var(--color-warning)
  // Fix 4: var(var(--color-danger)) → var(--color-danger)
  // Fix 5: var(var(--color-info-hover)) → var(--color-info-hover)
  // Fix 6: var(var(--scrim)) → var(--scrim)
  content = content.replace(/var\(var\(([^)]+)\)\)/g, 'var($1)');

  // Fix 7: var(white) → white (white is not a CSS custom property)
  content = content.replace(/var\(white\)/g, 'white');

  // Fix 8: var(black) → black
  content = content.replace(/var\(black\)/g, 'black');

  // Fix 9: var(--color-success, var(var(--color-success))) → var(--color-success)
  // This handles the desktopColors.ts pattern where fallback duplicates the value
  content = content.replace(/var\(([^,]+),\s*var\(var\(\1\)\)\)/g, 'var($1)');

  // Fix 10: var(--color-success, var(--color-success)) → var(--color-success)
  content = content.replace(/var\(([^,]+),\s*var\(\1\)\)/g, 'var($1)');

  if (content !== original) {
    writeFileSync(f, content);
    const fixes = (original.match(/var\(var\(/g) || []).length +
                  (original.match(/var\(white\)/g) || []).length +
                  (original.match(/var\(black\)/g) || []).length;
    console.log('Fixed: ' + f + ' (' + fixes + ' issues)');
    totalFixes += fixes;
  }
}
console.log('Total fixes: ' + totalFixes);
