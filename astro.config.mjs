// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  site: 'https://wordforge.app',
  output: 'static',
  compressHTML: true,
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: 'lightningcss',
    },
  },
  integrations: [
    preact({
      include: ['**/components/**/*.tsx'],
    }),
  ],
  prefetch: {
    prefetchAll: false,
  },
});
