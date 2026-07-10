import fs from 'node:fs';
import sourceMap from 'source-map-js';

const mapPath = 'C:\\Users\\jakub\\Desktop\\Vanguard\\dist\\assets\\DesktopDashboard-DZMkpMCZ.js.map';
if (!fs.existsSync(mapPath)) {
  console.error('Source map file does not exist at:', mapPath);
  process.exit(1);
}

const rawSourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const consumer = new sourceMap.SourceMapConsumer(rawSourceMap);

const line = 1;
const column = 3485;

const originalPos = consumer.originalPositionFor({
  line: line,
  column: column
});

console.log('--- Original Position ---');
console.log('Source:', originalPos.source);
console.log('Line:', originalPos.line);
console.log('Column:', originalPos.column);
console.log('Name:', originalPos.name);
console.log('-------------------------');
