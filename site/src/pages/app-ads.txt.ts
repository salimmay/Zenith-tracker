import type { APIRoute } from 'astro';
import { site } from '../site.config.ts';
import { appAdsTxt } from '../lib/launch.ts';

export const GET: APIRoute = () =>
  new Response(appAdsTxt(site.admobPublisherId), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
