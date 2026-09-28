// Builds the site into a throwaway folder with env overrides, so tests can
// check both launch states (before and after the Play listing exists).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();

/** Build once per distinct env and return a reader for the output folder. */
export function build(name, env = {}) {
  const key = JSON.stringify(env);
  if (cache.has(key)) return cache.get(key);
  const outDir = join(root, 'test', '.out', name);
  rmSync(outDir, { recursive: true, force: true });
  const clean = { ...process.env };
  for (const k of ['PLAY_STORE_URL', 'ADMOB_PUBLISHER_ID', 'SUPPORT_EMAIL', 'SITE_URL']) delete clean[k];
  execFileSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: root,
    env: { ...clean, ...env, SITE_OUT: outDir },
    stdio: 'pipe',
  });
  const out = {
    dir: outDir,
    has: (p) => existsSync(join(outDir, p)),
    read: (p) => readFileSync(join(outDir, p), 'utf8'),
    htmlFiles: () => walk(outDir).filter((f) => f.endsWith('.html')),
  };
  cache.set(key, out);
  return out;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
