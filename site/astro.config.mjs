// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/site.config.ts';

export default defineConfig({
  site: site.siteUrl,
  output: 'static',
  outDir: process.env.SITE_OUT || './dist',
  trailingSlash: 'never',
  build: { format: 'file' }, // /privacy.html → served at /privacy by Firebase cleanUrls
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
