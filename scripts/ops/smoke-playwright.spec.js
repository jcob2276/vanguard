import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load env variables from the root .env file if they are not already set
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

test('Test dashboard login and click through all functions', async ({ page }) => {
  const errors = [];
  const consoleErrors = [];

  // Capture all console errors
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type().toUpperCase();
    if (type === 'ERROR' || text.includes('failed to load') || text.includes('uncaught')) {
      consoleErrors.push(`[CONSOLE ERROR] ${text}`);
      console.log(`[CONSOLE ERROR] ${text}`);
    } else {
      console.log(`[CONSOLE ${type}] ${text}`);
    }
  });

  // Capture uncaught exceptions
  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}\nStack: ${err.stack}`);
    console.log(`[PAGE ERROR/EXCEPTION] ${err.message}`);
  });

  // Initialize Supabase admin client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SB_SECRET_KEY;
  const userId = process.env.VANGUARD_USER_ID;

  if (!supabaseUrl || !serviceRoleKey || !userId) {
    throw new Error('Missing Supabase configuration in environment variables');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Fetch email
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    throw new Error(`Failed to fetch user by ID: ${userError?.message || 'user not found'}`);
  }

  console.log(`Generating magic link for: ${user.email}`);
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: {
      redirectTo: 'http://localhost:5173/'
    }
  });

  if (linkError || !linkData?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${linkError?.message || 'no action link'}`);
  }

  const actionLink = linkData.properties.action_link;
  console.log(`Navigating to magic link to authenticate...`);

  await page.goto(actionLink);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // Wait for redirects and React load

  console.log(`Current URL after login redirection: ${page.url()}`);

  const screenyDir = path.resolve(process.cwd(), 'screeny');
  if (!fs.existsSync(screenyDir)) {
    fs.mkdirSync(screenyDir, { recursive: true });
  }

  // 1. Check if we are logged in by looking for Auth screen elements or finding Dashboard content
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible()) {
    await page.screenshot({ path: path.join(screenyDir, 'failed-login.png') });
    throw new Error('Authentication failed: Still showing login screen');
  }

  await page.screenshot({ path: path.join(screenyDir, '01-dashboard-home.png') });
  console.log('Successfully logged in! Saved 01-dashboard-home.png');

  // List of routes to test
  const routes = [
    { name: 'Dashboard', path: '/' },
    { name: 'Desktop Dashboard', path: '/dashboard' },
    { name: 'Settings', path: '/settings' },
    { name: 'Rozwoj', path: '/rozwoj' },
    { name: 'Badania', path: '/badania' },
    { name: 'Korelacjes', path: '/korealcje' },
    { name: 'Optics', path: '/optics' }
  ];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    console.log(`\n--- Testing route: ${route.name} (${route.path}) ---`);

    // Go to route
    await page.goto(`http://localhost:5173${route.path}`);

    // Wait for page load
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000); // Give time for charts, fetch calls, etc.

    // Capture screenshot
    const screenshotName = `${String(i + 1).padStart(2, '0')}-${route.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    const screenshotPath = path.join(screenyDir, screenshotName);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // Check if we hit error boundary or empty screen
    const bodyText = await page.innerText('body');
    if (bodyText.includes('Something went wrong') || bodyText.includes('Wystąpił błąd') || bodyText.length < 50) {
      console.log(`[WARNING] Route ${route.name} seems broken or empty! Body text length: ${bodyText.length}`);
    }
  }

  console.log('\n--- Test Summary ---');
  console.log(`Uncaught page errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(errors.join('\n'));
  }
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log(consoleErrors.join('\n'));
  }

  expect(errors.length).toBe(0);
});
