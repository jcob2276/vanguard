import { test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load env variables
function loadEnv() {
  try {
    const dotenvPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(dotenvPath)) {
      const envContent = fs.readFileSync(dotenvPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading env file:', err);
  }
}

loadEnv();

test('Detailed error trace on preview /dashboard', async ({ page }) => {
  page.on('pageerror', err => {
    console.log(`[PREVIEW PAGE ERROR] Name: ${err.name}\nMessage: ${err.message}\nStack: ${err.stack}`);
  });

  // Initialize Supabase admin client to generate link
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SB_SECRET_KEY;
  const userId = process.env.VANGUARD_USER_ID;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: { redirectTo: 'http://localhost:4173/' }
  });

  console.log('Logging in to preview server...');
  await page.goto(linkData.properties.action_link);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Navigating to /dashboard on preview server...');
  await page.goto('http://localhost:4173/dashboard');
  
  // Wait for the error or wait a bit
  await page.waitForTimeout(5000);
});
