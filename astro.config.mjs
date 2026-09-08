// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import node from '@astrojs/node';
import remarkMedia from './src/plugins/remark-media.mjs';

// Keystatic's admin routes are server-rendered, so they are loaded only for
// `npm run cms`. The GitHub Pages build stays fully static.
const cms = process.env.KEYSTATIC === '1';

export default defineConfig({
  site: 'https://varganovarsen.github.io',
  output: 'static',
  markdown: { remarkPlugins: [remarkMedia] },
  integrations: cms ? [react(), keystatic()] : [],
  adapter: cms ? node({ mode: 'standalone' }) : undefined,
});
