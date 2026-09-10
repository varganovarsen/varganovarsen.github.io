// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import node from '@astrojs/node';
import remarkMedia from './src/plugins/remark-media.mjs';
import remarkDemoteHeadings from './src/plugins/remark-demote-headings.mjs';
import remarkChips from './src/plugins/remark-chips.mjs';
import remarkLinks from './src/plugins/remark-links.mjs';
import sitemap from '@astrojs/sitemap';
import reviewNotes from './src/plugins/review-notes.mjs';

// Keystatic's admin routes are server-rendered, so they are loaded only for
// `npm run cms`. The GitHub Pages build stays fully static.
const cms = process.env.KEYSTATIC === '1';

const sitemapOptions = {
  i18n: { defaultLocale: 'ru', locales: { ru: 'ru', en: 'en' } },
};

export default defineConfig({
  site: 'https://varganovarsen.github.io',
  output: 'static',
  // Russian stays at the root, English lives under /en/ (see src/i18n.ts).
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: { remarkPlugins: [remarkDemoteHeadings, remarkMedia, remarkLinks, remarkChips] },
  integrations: cms
    ? [sitemap(sitemapOptions), reviewNotes(), react(), keystatic()]
    : [sitemap(sitemapOptions), reviewNotes()],
  adapter: cms ? node({ mode: 'standalone' }) : undefined,
});
