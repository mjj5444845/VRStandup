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

test('Pages export cannot overwrite the laboratory production build', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const readConfig = (target: string) => JSON.parse(execFileSync(process.execPath, [
    '--import', 'tsx', '--input-type=module', '-e',
    "import overrides from './next.config.ts'; import { defaultConfig } from 'next/dist/server/config-shared.js'; import { getBuildDistDir } from 'next/dist/export/utils.js'; const config = { ...defaultConfig, ...overrides }; console.log(JSON.stringify({ build: getBuildDistDir(config), destination: config.distDir, basePath: config.basePath }));",
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, PUNCHCAP_BUILD_TARGET: target } })) as { build: string; destination: string; basePath: string };
  const lab = readConfig('lab'), pages = readConfig('pages');
  assert.notEqual(lab.build, pages.build, 'Next static export uses .next internally, even with a custom export destination');
  assert.notEqual(lab.build, pages.destination);
  assert.equal(lab.basePath, '');
  assert.equal(pages.basePath, '/VRStandup');
});
