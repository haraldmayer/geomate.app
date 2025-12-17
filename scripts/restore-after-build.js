import { renameSync, existsSync, rmSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');
const pagesDir = join(srcDir, 'pages');
const dataDir = join(__dirname, '..', 'public', 'data');
const tempDir = join(__dirname, '..', '.temp-build');

console.log('🔄 Restoring source files...');

// Restore CMS and API files from temp directory
const cmsPath = join(pagesDir, 'cms.astro');
const apiPath = join(pagesDir, 'api');
const cmsBackupPath = join(tempDir, 'cms.astro');
const apiBackupPath = join(tempDir, 'api');

if (existsSync(cmsBackupPath)) {
  renameSync(cmsBackupPath, cmsPath);
  console.log('✅ Restored cms.astro');
}

if (existsSync(apiBackupPath)) {
  renameSync(apiBackupPath, apiPath);
  console.log('✅ Restored /api directory');
}

// Restore lists.json from backup
const listsPath = join(dataDir, 'lists.json');
const listsBackupPath = join(tempDir, 'lists.json');

if (existsSync(listsBackupPath)) {
  copyFileSync(listsBackupPath, listsPath);
  console.log('✅ Restored lists.json');
}

// Clean up temp directory
if (existsSync(tempDir)) {
  rmSync(tempDir, { recursive: true, force: true });
  console.log('✅ Cleaned up temp directory');
}

console.log('✨ Source files restored!');
