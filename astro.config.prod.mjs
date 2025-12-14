// @ts-check
import { defineConfig } from 'astro/config';

// Static build configuration for production (no SSR, no CMS)
// https://astro.build/config
export default defineConfig({
  output: 'static',
  // No adapter needed for static builds
});
