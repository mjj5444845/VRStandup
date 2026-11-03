import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
test('Vercel ignore rules retain application source and the shared task catalog', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '--', 'app', 'study', 'scripts', 'docs/project/tasks.json'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(p => /\.(?:tsx?|mjs|css|json)$/.test(p));
  assert.ok(source.includes('study/spikes/xr-support.ts') && source.includes('docs/project/tasks.json'));
  const result = spawnSync('git', ['-c', `core.excludesfile=${path.join(root, '.vercelignore')}`, 'check-ignore', '--no-index', '--stdin'], { cwd: root, input: source.join('\n') + '\n', encoding: 'utf8' });
  assert.equal(result.status, 1, `Build sources are excluded: ${result.stdout}\n${result.stderr}`);
});
