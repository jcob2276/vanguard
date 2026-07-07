#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const outputDir = process.env.BACKUP_OUTPUT_DIR || './vanguard-backup-temp';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllFiles(bucketName, folder = '') {
  let files = [];
  const { data, error } = await supabase.storage.from(bucketName).list(folder, { limit: 100 });
  if (error) {
    // If bucket doesn't exist, we log a warning but don't fail the whole backup
    if (error.message && error.message.includes('not found')) {
      console.warn(`Warning: Bucket "${bucketName}" not found.`);
      return [];
    }
    throw error;
  }
  if (!data) return [];
  
  for (const item of data) {
    // folders have id = null or metadata = null, but checked by lack of metadata/id
    if (!item.id && item.name) {
      const subFiles = await listAllFiles(bucketName, folder ? `${folder}/${item.name}` : item.name);
      files = files.concat(subFiles);
    } else if (item.name && item.name !== '.emptyFolderPlaceholder') {
      files.push(folder ? `${folder}/${item.name}` : item.name);
    }
  }
  return files;
}

async function downloadFile(bucketName, filePath, targetDir) {
  const { data, error } = await supabase.storage.from(bucketName).download(filePath);
  if (error) {
    console.error(`Failed to download ${filePath} from ${bucketName}:`, error.message);
    return;
  }
  const targetPath = path.join(targetDir, filePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
  console.log(`Downloaded: ${bucketName}/${filePath}`);
}

async function main() {
  console.log('--- Starting Vanguard OS Backup ---');
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Dump Database
  if (databaseUrl) {
    console.log('Dumping database...');
    const dbDumpPath = path.join(outputDir, 'db.sql');
    try {
      execSync(`pg_dump "${databaseUrl}" --no-owner --no-privileges -f "${dbDumpPath}"`, { stdio: 'inherit' });
      console.log('Database dump completed successfully.');
    } catch (err) {
      console.error('Failed to run pg_dump:', err.message);
      process.exit(1);
    }
  } else {
    console.warn('Warning: DATABASE_URL not provided. Skipping database dump.');
  }

  // 2. Backup Storage Buckets
  const buckets = ['progress-photos', 'todo-attachments'];
  for (const bucket of buckets) {
    console.log(`Backing up bucket: ${bucket}...`);
    const bucketDir = path.join(outputDir, 'buckets', bucket);
    fs.mkdirSync(bucketDir, { recursive: true });

    try {
      const files = await listAllFiles(bucket);
      console.log(`Found ${files.length} files in bucket "${bucket}".`);
      for (const file of files) {
        await downloadFile(bucket, file, bucketDir);
      }
    } catch (err) {
      console.error(`Failed to backup bucket "${bucket}":`, err.message);
      // We do not exit(1) here so that other buckets/DB can still finish backing up
    }
  }

  console.log('--- Backup Process Completed Successfully ---');
}

main().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
