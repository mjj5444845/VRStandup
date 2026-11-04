import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
let revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown', dirty = false;
try { if (revision === 'unknown') revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* Builds without Git retain an explicit unknown revision. */ }
if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(revision)) revision = 'unknown';
await fs.mkdir('public/study', { recursive: true });
await fs.writeFile('public/study/build.json', JSON.stringify({ revision, dirty, builtAt: new Date().toISOString(), assetVersion: 'club-v1' }) + '\n');
