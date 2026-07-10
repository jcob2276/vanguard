import fs from 'node:fs';

const chunkPath = 'c:/Users/jakub/Desktop/Vanguard/dist/assets/DesktopDashboard-DZMkpMCZ.js';
if (!fs.existsSync(chunkPath)) {
  console.error('Chunk file does not exist');
  process.exit(1);
}

const content = fs.readFileSync(chunkPath, 'utf-8');
const index = 3485;

// Print a window of 200 characters around the index
const start = Math.max(0, index - 150);
const end = Math.min(content.length, index + 150);

console.log('--- Code surrounding index 3485 ---');
console.log(content.slice(start, index) + ' >>>HERE>>> ' + content.slice(index, end));
console.log('-----------------------------------');
