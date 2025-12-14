import { renameSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');
const pagesDir = join(srcDir, 'pages');
const tempDir = join(__dirname, '..', '.temp-build');

console.log('🔧 Preparing for static build...');

// Create temp directory if it doesn't exist
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

// Move CMS and API files outside of src to prevent Astro from seeing them
const cmsPath = join(pagesDir, 'cms.astro');
const apiPath = join(pagesDir, 'api');
const cmsBackupPath = join(tempDir, 'cms.astro');
const apiBackupPath = join(tempDir, 'api');

if (existsSync(cmsPath)) {
  renameSync(cmsPath, cmsBackupPath);
  console.log('✅ Temporarily moved cms.astro');
}

if (existsSync(apiPath)) {
  renameSync(apiPath, apiBackupPath);
  console.log('✅ Temporarily moved /api directory');
}

console.log('✨ Ready for static build!');
