import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const ignoredDirs = new Set([
  '.git',
  '.temp',
  'node_modules',
  'dist',
  'scratch',
  '.supabase',
  '.agents',
  '.claude',
]);

const ignoredFiles = new Set([
  'package-lock.json',
  'oss-audit.mjs',
]);

const checks = [
  {
    name: 'real_supabase_project_ref',
    pattern: /pdvqkgfsqziqlhptatgf/gi,
    severity: 'blocker',
  },
  {
    name: 'hardcoded_private_user_id',
    pattern: /165ae341-670c-46ce-82dc-434c4dbfcdfd/gi,
    severity: 'blocker',
  },
  {
    name: 'local_windows_user_path',
    pattern: /C:\\Users\\jakub/gi,
    severity: 'blocker',
  },
  {
    name: 'personal_name_context',
    pattern: /\b(Jakub|Kuba|jakubsobon)\b/gi,
    severity: 'review',
  },
  {
    name: 'google_oauth_client_id',
    pattern: /111163364613-[a-z0-9]+\.apps\.googleusercontent\.com/gi,
    severity: 'review',
  },
  {
    name: 'openai_secret_key_shape',
    pattern: /sk-[A-Za-z0-9_-]{20,}/g,
    severity: 'blocker',
  },
  {
    name: 'telegram_bot_token_shape',
    pattern: /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g,
    severity: 'blocker',
  },
];

const localOnlyFiles = [
  '.env',
  'poranek.txt',
  'poranek_v2_elevenlabs.txt',
  'wizualizacja_sen.txt',
  'wizualizacja_sen_v2_elevenlabs.txt',
  'wizualizacja_sen_v3_long_elevenlabs.txt',
  'run-chart-20260530.html',
  'run-points-20260530.json',
  'run-streams-20260530.json',
];
for (const file of localOnlyFiles) ignoredFiles.add(path.basename(file));

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...walk(absolute));
      continue;
    }

    if (ignoredFiles.has(entry.name)) continue;
    if (entry.size > 2_000_000) continue;
    files.push({ absolute, relative });
  }

  return files;
}

function isProbablyText(buffer) {
  return !buffer.includes(0);
}

const findings = [];

for (const file of walk(root)) {
  const buffer = fs.readFileSync(file.absolute);
  if (!isProbablyText(buffer)) continue;

  const text = buffer.toString('utf8');
  for (const check of checks) {
    const matches = [...text.matchAll(check.pattern)];
    for (const match of matches) {
      const before = text.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      findings.push({
        severity: check.severity,
        name: check.name,
        file: file.relative,
        line,
      });
    }
  }
}

for (const file of localOnlyFiles) {
  if (fs.existsSync(path.join(root, file))) {
    findings.push({
      severity: 'review',
      name: 'local_private_artifact_present',
      file,
      line: 1,
    });
  }
}

const blockerCount = findings.filter((f) => f.severity === 'blocker').length;

if (findings.length === 0) {
  console.log('OSS audit passed: no public-readiness findings.');
  process.exit(0);
}

console.log(`OSS audit findings: ${findings.length} (${blockerCount} blockers)\n`);
for (const finding of findings) {
  console.log(`${finding.severity.toUpperCase()} ${finding.name} ${finding.file}:${finding.line}`);
}

process.exit(blockerCount > 0 ? 1 : 0);
