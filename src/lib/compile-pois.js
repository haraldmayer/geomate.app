import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Compile all individual POI files into a single all-pois.json file
 */
export function compilePOIs() {
  try {
    const poisDir = join(process.cwd(), 'public', 'data', 'pois');
    const outputFile = join(process.cwd(), 'public', 'data', 'all-pois.json');

    // Read all POI files
    const files = readdirSync(poisDir).filter(f => f.endsWith('.json'));

    const pois = files.map(file => {
      const content = readFileSync(join(poisDir, file), 'utf-8');
      return JSON.parse(content);
    });

    // Write compiled file
    writeFileSync(outputFile, JSON.stringify(pois, null, 2));

    console.log(`✅ Compiled ${pois.length} POIs to all-pois.json`);
    return { success: true, count: pois.length };
  } catch (error) {
    console.error('❌ Error compiling POIs:', error);
    return { success: false, error: error.message };
  }
}
