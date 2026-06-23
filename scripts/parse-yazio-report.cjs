// One-off parser: extracts food items from the Yazio diet export markdown
// and normalizes them to per-100g/ml macros for seeding a personal food
// library cache. Run with: node scripts/parse-yazio-report.cjs <path>
const fs = require('fs');

const path = process.argv[2];
if (!path) { console.error('usage: node parse-yazio-report.cjs <report.md>'); process.exit(1); }
const text = fs.readFileSync(path, 'utf8');

// Matches: "- NAME [— BRAND] (AMOUNT unit): KCAL kcal | B: Xg | W: Yg | T: Zg | ...rest"
const LINE_RE = /^- (.+?)(?:\s+—\s+(.+?))?\s*\((\d+(?:\.\d+)?)\s*[^)]*\):\s*(\d+(?:\.\d+)?)\s*kcal\s*\|\s*B:\s*([\d.]+)g\s*\|\s*W:\s*([\d.]+)g\s*\|\s*T:\s*([\d.]+)g(.*)$/;
const FIBER_RE = /Bł:\s*([\d.]+)g/;
const SUGAR_RE = /Cuk:\s*([\d.]+)g/;

// Yazio's "brand" field is frequently just a repeated/descriptive label for
// homemade or generic items ("Domowe", "Jajecznica" as the brand of
// "Jajecznica z 3 jaj"), not an actual manufacturer — those would pollute a
// product catalog as fake brands, so strip them.
const JUNK_BRANDS = new Set([
  'dom', 'domowa', 'domowe', 'domowy', 'produkcja własna', 'wyrob wlasny',
  'sklep', 'restauracja', 'owoce', 'warzywa', 'kawa', 'pieczarki', 'sałata',
  'surowka', 'chleb', 'mieso mielone', 'ja', 'i', 'frytki zwykłe', 'z budki',
]);
const BRAND_NORMALIZE = {
  'mcdonald': "McDonald's", "mcdonald's": "McDonald's", 'mcdonald’s': "McDonald's", 'macdonald': "McDonald's",
  'piatnica': 'Piątnica', 'tarczynski': 'Tarczyński',
};

function cleanBrand(rawBrand, name) {
  if (!rawBrand) return null;
  const norm = rawBrand.trim().toLowerCase();
  if (JUNK_BRANDS.has(norm)) return null;
  if (norm === name.toLowerCase()) return null;
  if (name.toLowerCase().includes(norm) || norm.includes(name.toLowerCase())) return null;
  return BRAND_NORMALIZE[norm] || rawBrand.trim().replace(/\s+/g, ' ');
}

const groups = new Map(); // key: name|brand -> { occurrences: [...] }

for (const rawLine of text.split('\n')) {
  const line = rawLine.trim();
  const m = LINE_RE.exec(line);
  if (!m) continue;
  const [, rawName, rawBrand, amountStr, kcalStr, pStr, cStr, fStr, rest] = m;
  const amount = parseFloat(amountStr);
  if (!amount || amount <= 0) continue; // empty "()" composite dishes have no amount — skip, not a reusable product

  const name = rawName.trim().replace(/\s+/g, ' ');
  const brand = cleanBrand(rawBrand, name);
  const key = `${name.toLowerCase()}|${(brand || '').toLowerCase()}`;

  const fiberM = FIBER_RE.exec(rest);
  const sugarM = SUGAR_RE.exec(rest);

  const scale = 100 / amount;
  const entry = {
    amount,
    calories: parseFloat(kcalStr) * scale,
    protein: parseFloat(pStr) * scale,
    carbs: parseFloat(cStr) * scale,
    fat: parseFloat(fStr) * scale,
    fiber: fiberM ? parseFloat(fiberM[1]) * scale : null,
    sugar: sugarM ? parseFloat(sugarM[1]) * scale : null,
  };

  if (!groups.has(key)) groups.set(key, { name, brand, occurrences: [] });
  groups.get(key).occurrences.push(entry);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mode(arr) {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let best = arr[0], bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c; }
  return best;
}

const products = [];
for (const { name, brand, occurrences } of groups.values()) {
  if (occurrences.length === 0) continue;
  const round1 = (n) => Math.round(n * 10) / 10;
  const avg = (key) => {
    const vals = occurrences.map((o) => o[key]).filter((v) => v != null);
    return vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  products.push({
    name,
    brand,
    occurrences: occurrences.length,
    default_grams: Math.round(mode(occurrences.map((o) => o.amount))),
    calories: Math.round(avg('calories')),
    protein: avg('protein'),
    carbs: avg('carbs'),
    fat: avg('fat'),
    fiber: avg('fiber'),
    sugar: avg('sugar'),
  });
}

products.sort((a, b) => b.occurrences - a.occurrences);
console.log(JSON.stringify(products, null, 2));
console.error(`\n${products.length} unique products parsed from ${groups.size} groups.`);
