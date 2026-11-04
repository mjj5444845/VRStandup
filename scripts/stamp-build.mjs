import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
let revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown', dirty = false;
try { if (revision === 'unknown') revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* Builds without Git retain an explicit unknown revision. */ }
if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(revision)) revision = 'unknown';
if (dirty) {
  try {
    // Only tracked public source paths are logged; never print untracked private filenames.
    const tracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    console.warn(tracked ? `Build workspace source changes:\n${tracked}` : 'Build workspace contains untracked files.');
  } catch { /* Keep the dirty marker even when diagnostics are unavailable. */ }
}
await fs.mkdir('public/study', { recursive: true });
await fs.writeFile('public/study/build.json', JSON.stringify({ revision, dirty, builtAt: new Date().toISOString(), assetVersion: 'club-v1' }) + '\n');
