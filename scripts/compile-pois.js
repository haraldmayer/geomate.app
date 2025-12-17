import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get tag filter from command line argument
const tagFilter = process.argv[2];

if (tagFilter) {
  console.log(`📦 Compiling POIs with tag filter: "${tagFilter}"...`);
} else {
  console.log('📦 Compiling all POIs...');
}

const poisDir = join(__dirname, '..', 'public', 'data', 'pois');
const outputFile = join(__dirname, '..', 'public', 'data', 'all-pois.json');
const listsInputFile = join(__dirname, '..', 'public', 'data', 'lists.json');
const listsOutputFile = join(__dirname, '..', 'public', 'data', 'lists.json');

try {
  // Read all POI files
  const files = readdirSync(poisDir).filter(f => f.endsWith('.json'));

  let pois = files.map(file => {
    const content = readFileSync(join(poisDir, file), 'utf-8');
    return JSON.parse(content);
  });

  // Filter POIs by tag if specified
  if (tagFilter) {
    pois = pois.filter(poi => {
      const tags = poi.properties.tags || [];
      return tags.includes(tagFilter);
    });
  }

  console.log(`✅ Compiled ${pois.length} POIs${tagFilter ? ` with tag "${tagFilter}"` : ''}`);

  // Write compiled POIs file
  writeFileSync(outputFile, JSON.stringify(pois, null, 2));
  console.log(`✅ Written to /public/data/all-pois.json`);

  // Filter lists by tag if specified
  if (tagFilter) {
    const listsContent = readFileSync(listsInputFile, 'utf-8');
    const listsData = JSON.parse(listsContent);

    const filteredLists = listsData.lists.filter(list => {
      const tags = list.tags || [];
      return tags.includes(tagFilter);
    });

    // Write filtered lists
    writeFileSync(listsOutputFile, JSON.stringify({ lists: filteredLists }, null, 2) + '\n');
    console.log(`✅ Filtered ${filteredLists.length} lists with tag "${tagFilter}"`);
  }

} catch (error) {
  console.error('❌ Error compiling POIs:', error);
  process.exit(1);
}
