import { spawn } from 'node:child_process';

const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return response;
    } catch {
      await wait(250);
    }
  }
  throw new Error(`Vite preview did not respond at ${baseUrl}`);
}

const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

let output = '';
child.stdout.on('data', chunk => {
  output += chunk.toString();
});
child.stderr.on('data', chunk => {
  output += chunk.toString();
});

try {
  const response = await waitForServer();
  const html = await response.text();
  if (!html.includes('id="root"')) {
    throw new Error('Preview HTML does not contain #root');
  }

  const scriptMatch = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*>/);
  if (!scriptMatch) {
    throw new Error('Preview HTML does not reference a JS bundle');
  }

  const bundleUrl = new URL(scriptMatch[1], baseUrl).toString();
  const bundleResponse = await fetch(bundleUrl);
  if (!bundleResponse.ok) {
    throw new Error(`JS bundle is not reachable: ${bundleResponse.status} ${bundleUrl}`);
  }

  console.log(`UI smoke OK: ${baseUrl} served HTML and bundle`);
} catch (error) {
  console.error(output.trim());
  console.error(error);
  process.exitCode = 1;
} finally {
  child.kill();
}
