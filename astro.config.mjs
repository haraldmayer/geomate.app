// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';

// Cloudflare Pages sets CF_PAGES=1 during build
const isCloudflare = process.env.CF_PAGES === '1' || process.env.CF_PAGES_BRANCH !== undefined;

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isCloudflare
    ? cloudflare({
        imageService: 'cloudflare'
      })
    : node({
        mode: 'standalone'
      })
});
