#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const inputDir = process.env.BACKUP_INPUT_DIR || './vanguard-backup-temp';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureBucketExists(bucketName) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets.some((b) => b.name === bucketName);
  if (!exists) {
    console.log(`Creating bucket "${bucketName}"...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    if (createError) throw createError;
    console.log(`Bucket "${bucketName}" created successfully.`);
  } else {
    console.log(`Bucket "${bucketName}" already exists.`);
  }
}

function getFilesRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

async function uploadFile(bucketName, localFilePath, bucketBaseDir) {
  const relativePath = path.relative(bucketBaseDir, localFilePath).replace(/\\/g, '/');
  const fileBuffer = fs.readFileSync(localFilePath);

  console.log(`Uploading: ${bucketName}/${relativePath}...`);
  const { error } = await supabase.storage.from(bucketName).upload(relativePath, fileBuffer, {
    upsert: true,
  });

  if (error) {
    console.error(`Failed to upload ${relativePath} to ${bucketName}:`, error.message);
  } else {
    console.log(`Uploaded successfully: ${bucketName}/${relativePath}`);
  }
}

async function main() {
  console.log('--- Starting Vanguard OS Restore ---');

  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory "${inputDir}" does not exist.`);
    process.exit(1);
  }

  // 1. Restore Database Dump
  const dbDumpPath = path.join(inputDir, 'db.sql');
  if (fs.existsSync(dbDumpPath)) {
    if (databaseUrl) {
      console.log('Restoring database from SQL dump...');
      try {
        // Run SQL dump using psql
        execSync(`psql "${databaseUrl}" -f "${dbDumpPath}"`, { stdio: 'inherit' });
        console.log('Database restore completed successfully.');
      } catch (err) {
        console.error('Failed to run psql restore:', err.message);
        process.exit(1);
      }
    } else {
      console.warn('Warning: DATABASE_URL not provided. Skipping database restore.');
    }
  } else {
    console.warn(`No db.sql found at ${dbDumpPath}. Skipping database restore.`);
  }

  // 2. Restore Storage Buckets
  const bucketsDir = path.join(inputDir, 'buckets');
  if (fs.existsSync(bucketsDir)) {
    const bucketFolders = fs.readdirSync(bucketsDir);
    for (const bucketName of bucketFolders) {
      const bucketBaseDir = path.join(bucketsDir, bucketName);
      if (fs.statSync(bucketBaseDir).isDirectory()) {
        console.log(`Processing restore for bucket: ${bucketName}...`);
        try {
          await ensureBucketExists(bucketName);
          const files = getFilesRecursive(bucketBaseDir);
          console.log(`Found ${files.length} local files to upload to "${bucketName}".`);
          for (const file of files) {
            await uploadFile(bucketName, file, bucketBaseDir);
          }
        } catch (err) {
          console.error(`Failed to restore bucket "${bucketName}":`, err.message);
        }
      }
    }
  } else {
    console.log('No buckets backup directory found. Skipping storage restore.');
  }

  console.log('--- Restore Process Completed Successfully ---');
}

main().catch((err) => {
  console.error('Fatal restore error:', err);
  process.exit(1);
});
