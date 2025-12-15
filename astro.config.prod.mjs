// @ts-check
import { defineConfig } from 'astro/config';

// Static build configuration for production (no SSR, no CMS)
// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    build: {
      // Ensure asset filenames include content hash for cache busting
      rollupOptions: {
        output: {
          entryFileNames: 'entry.[hash].js',
          chunkFileNames: 'chunks/chunk.[hash].js',
          assetFileNames: 'assets/asset.[hash][extname]'
        }
      }
    }
  }
});
