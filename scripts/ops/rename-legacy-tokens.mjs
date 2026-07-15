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
// Match definition lines like: --legacy-X: value;
const varRegex = /(--legacy-[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
let match;
while ((match = varRegex.exec(indexCssContent)) !== null) {
  definitions[match[1]] = match[2].trim();
}

console.log(`Found ${Object.keys(definitions).length} legacy variable definitions in index.css`);

// 2. Scan all files in src/ (INCLUDING index.css) for references
// A reference is any occurrence of the variable name that is NOT followed by a colon and is matched in full (no partial word matching)
const files = getAllFiles(srcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css'));
const usageCounts = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Match full --legacy-X token names not followed by a colon
  const usageRegex = /--legacy-[a-zA-Z0-9_-]+(?![a-zA-Z0-9_-])(?!\s*:)/g;
  let useMatch;
  while ((useMatch = usageRegex.exec(content)) !== null) {
    const name = useMatch[0];
    usageCounts[name] = (usageCounts[name] || 0) + 1;
  }
}

console.log(`Found ${Object.keys(usageCounts).length} distinct legacy variables actually referenced in src/ code`);

const unused = [];
const used = [];

for (const name of Object.keys(definitions)) {
  if (!usageCounts[name]) {
    unused.push(name);
  } else {
    used.push({ name, count: usageCounts[name], value: definitions[name] });
  }
}

console.log(`Deleting ${unused.length} unused variables from index.css`);
console.log(`Renaming ${used.length} used variables across the codebase`);

// 3. Filter out unused variables definitions from index.css (line-by-line)
const cssLines = indexCssContent.split('\n');
const filteredCssLines = cssLines.filter(line => {
  const definitionMatch = line.match(/^\s*(--legacy-[a-zA-Z0-9_-]+)\s*:/);
  if (definitionMatch) {
    const varName = definitionMatch[1];
    if (unused.includes(varName)) {
      return false; // delete this line
    }
  }
  return true;
});

let updatedCssContent = filteredCssLines.join('\n');

// 4. Generate unique semantic names for all used variables
const nameCounts = {};
const mapping = {};

function getSemanticName(name, value) {
  let baseName;
  if (name.includes('color')) {
    const cleanedVal = value.toLowerCase().trim();
    if (cleanedVal === '#6b7280') baseName = '--color-text-tertiary-muted';
    else if (cleanedVal === '#0f766e') baseName = '--color-teal-700';
    else if (cleanedVal === '#10b981') baseName = '--color-success-green';
    else if (cleanedVal === '#f43f5e') baseName = '--color-danger-red';
    else if (cleanedVal === '#f59e0b') baseName = '--color-warning-amber';
    else if (cleanedVal === '#3b82f6') baseName = '--color-info-blue';
    else if (cleanedVal === '#ffffff') baseName = '--color-pure-white';
    else if (cleanedVal === '#000000') baseName = '--color-pure-black';
    else {
      const hex = cleanedVal.replace('#', '').replace(/[^a-f0-9]/g, '');
      baseName = `--color-theme-hex-${hex || 'custom'}`;
    }
  } else {
    const parts = name.split('-');
    const category = parts.slice(3, -1).join('-') || 'misc';
    const safeVal = value.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/-$/, '').replace(/^-/, '').toLowerCase();
    baseName = `--ds-${category}-${safeVal || 'val'}`;
  }

  // Ensure uniqueness
  if (!nameCounts[baseName]) {
    nameCounts[baseName] = 1;
    return baseName;
  } else {
    nameCounts[baseName]++;
    return `${baseName}-coll-${nameCounts[baseName]}`;
  }
}

for (const item of used) {
  mapping[item.name] = getSemanticName(item.name, item.value);
}

// Add mappings for variables that are referenced but not defined in index.css (fallback handling)
const allUsedRefs = Object.keys(usageCounts);
for (const name of allUsedRefs) {
  if (!mapping[name]) {
    console.log(`Warning: Referenced variable ${name} has no definition in index.css. Generating fallback name.`);
    mapping[name] = getSemanticName(name, 'undefined');
  }
}

// 5. Replace legacy variable names with new names in index.css
for (const name of Object.keys(mapping)) {
  updatedCssContent = updatedCssContent.replaceAll(name, mapping[name]);
}
fs.writeFileSync(indexCssPath, updatedCssContent, 'utf8');

// 6. Replace legacy variable names with new names in all other files
let totalReplacements = 0;
const otherFiles = files.filter(f => f !== indexCssPath);
for (const file of otherFiles) {
  let fileContent = fs.readFileSync(file, 'utf8');
  let fileModified = false;
  
  for (const name of Object.keys(mapping)) {
    if (fileContent.includes(name)) {
      fileContent = fileContent.replaceAll(name, mapping[name]);
      fileModified = true;
      totalReplacements++;
    }
  }
  
  if (fileModified) {
    fs.writeFileSync(file, fileContent, 'utf8');
  }
}

console.log(`Successfully completed migration!`);
console.log(`Total source file replacements executed: ${totalReplacements}`);

// 7. Verify index.css has 0 legacy tokens left
const finalCssContent = fs.readFileSync(indexCssPath, 'utf8');
const legacyCountInCss = (finalCssContent.match(/--legacy-/g) || []).length;
console.log(`Verification: number of --legacy- tokens in index.css is now: ${legacyCountInCss}`);

if (legacyCountInCss > 0) {
  console.error('ERROR: Migration left remaining legacy tokens in index.css!');
  process.exit(1);
} else {
  console.log('SUCCESS: No legacy tokens found. Verification passed.');
}
