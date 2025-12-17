import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const poisDir = join(process.cwd(), 'public', 'data', 'pois');
const listsFile = join(process.cwd(), 'public', 'data', 'lists.json');

// Update all POIs
const poiFiles = readdirSync(poisDir).filter(f => f.endsWith('.json'));
let poisUpdated = 0;

console.log(`Found ${poiFiles.length} POI files`);

poiFiles.forEach(file => {
  const filePath = join(poisDir, file);
  const content = readFileSync(filePath, 'utf-8');
  const poi = JSON.parse(content);

  // Set tags to ["public", "m"]
  poi.properties.tags = ["public", "m"];

  writeFileSync(filePath, JSON.stringify(poi, null, 2) + '\n', 'utf-8');
  poisUpdated++;
});

console.log(`✓ Updated ${poisUpdated} POIs with tags: ["public", "m"]`);

// Update all lists
const listsContent = readFileSync(listsFile, 'utf-8');
const listsData = JSON.parse(listsContent);

listsData.lists.forEach(list => {
  list.tags = ["public", "m"];
});

writeFileSync(listsFile, JSON.stringify(listsData, null, 2) + '\n', 'utf-8');

console.log(`✓ Updated ${listsData.lists.length} lists with tags: ["public", "m"]`);
console.log('\nDone! All POIs and lists now have tags: ["public", "m"]');
