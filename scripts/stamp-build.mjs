import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
let revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown', dirty = false, sourceOmissions = 0, sourceNormalizations = 0;
const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const sortedJson = value => Array.isArray(value) ? value.map(sortedJson) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedJson(value[key])])) : value;
try {
  const head = git(['rev-parse', 'HEAD']).trim();
  if (revision === 'unknown') revision = head;
  dirty = true;
  const entries = git(['status', '--porcelain=v1', '-z']).split('\0').filter(Boolean), changes = [];
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2), file = entries[i].slice(3);
    changes.push({ status, file });
    if (/[RC]/.test(status)) i++;
  }
  // Vercel removes declared deployment exclusions from a checkout before building.
  // Only pure working-tree deletions, a matching immutable commit and this provider qualify.
  if (process.env.VERCEL === '1' && process.env.VERCEL_GIT_COMMIT_SHA === head) {
    const excluded = new Set(git(['ls-files', '--cached', '--ignored', '--exclude-from=.vercelignore', '-z']).split('\0').filter(Boolean));
    sourceOmissions = changes.filter(change => change.status === ' D' && excluded.has(change.file)).length;
    if (changes.some(change => change.status === ' M' && change.file === 'vercel.json')) {
      const committed = JSON.parse(git(['show', 'HEAD:vercel.json'])), current = JSON.parse(await fs.readFile('vercel.json', 'utf8'));
      // Accept formatting/key ordering only; changed configuration values remain dirty.
      if (JSON.stringify(sortedJson(committed)) === JSON.stringify(sortedJson(current))) sourceNormalizations = 1;
      else console.warn('Vercel configuration values differ from the committed source.');
    }
  }
  dirty = changes.length !== sourceOmissions + sourceNormalizations;
} catch { /* A known repository remains dirty if its source check cannot finish. */ }
if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(revision)) revision = 'unknown';
if (dirty) {
  try {
    // Only tracked public source paths are logged; never print untracked private filenames.
    const tracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    console.warn(tracked ? `Build workspace source changes:\n${tracked}` : 'Build workspace contains untracked files.');
  } catch { /* Keep the dirty marker even when diagnostics are unavailable. */ }
}
await fs.mkdir('public/study', { recursive: true });
await fs.writeFile('public/study/build.json', JSON.stringify({ revision, dirty, sourceOmissions, sourceNormalizations, builtAt: new Date().toISOString(), assetVersion: 'club-v1' }) + '\n');
