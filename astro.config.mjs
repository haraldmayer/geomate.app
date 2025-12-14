// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';

const isProduction = process.env.NODE_ENV === 'production';
const isCloudflare = process.env.CF_PAGES === '1';

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
