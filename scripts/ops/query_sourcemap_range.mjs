import fs from 'node:fs';
import sourceMap from 'source-map-js';

const mapPath = 'C:\\Users\\jakub\\Desktop\\Vanguard\\dist\\assets\\DesktopDashboard-DZMkpMCZ.js.map';
const rawSourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const consumer = new sourceMap.SourceMapConsumer(rawSourceMap);

console.log('Searching mappings near 3485...');
for (let col = 3400; col <= 3600; col++) {
  const originalPos = consumer.originalPositionFor({
    line: 1,
    column: col
  });
  if (originalPos.source) {
    console.log(`Col ${col} -> ${originalPos.source}:${originalPos.line}:${originalPos.column} (${originalPos.name})`);
  }
}
