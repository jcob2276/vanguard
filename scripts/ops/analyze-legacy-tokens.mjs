import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const srcDir = path.join(root, 'src');
const indexCssPath = path.join(srcDir, 'index.css');

// Find all files in src/
function getAllFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// 1. Parse index.css to find all defined --legacy- variables and their values
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');
const definitions = {};
const varRegex = /(--legacy-[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
let match;
while ((match = varRegex.exec(indexCssContent)) !== null) {
  definitions[match[1]] = match[2].trim();
}

console.log(`Found ${Object.keys(definitions).length} legacy variable definitions in index.css`);

// 2. Scan all files in src/ (except index.css) for references
const files = getAllFiles(srcDir).filter(f => f !== indexCssPath && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css')));
const usageCounts = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Look for any --legacy- variable names in var(--legacy-X) or bare --legacy-X
  const usageRegex = /--legacy-[a-zA-Z0-9_-]+/g;
  let useMatch;
  while ((useMatch = usageRegex.exec(content)) !== null) {
    const name = useMatch[0];
    usageCounts[name] = (usageCounts[name] || 0) + 1;
  }
}

console.log(`Found ${Object.keys(usageCounts).length} distinct legacy variables actually used in src/ code`);

const unused = [];
const used = [];

for (const name of Object.keys(definitions)) {
  if (!usageCounts[name]) {
    unused.push(name);
  } else {
    used.push({ name, count: usageCounts[name], value: definitions[name] });
  }
}

console.log(`Unused variables: ${unused.length}`);
console.log(`Used variables: ${used.length}`);

// Write the lists to a temp analysis file
fs.writeFileSync(
  path.join(root, 'legacy-analysis.json'),
  JSON.stringify({ used, unused }, null, 2),
  'utf8'
);

console.log('Analysis saved to legacy-analysis.json');
