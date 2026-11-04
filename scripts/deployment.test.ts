import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
test('Vercel ignore rules retain application source and the shared task catalog', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '--', 'app', 'study', 'scripts', 'docs/project/tasks.json'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(p => /\.(?:tsx?|mjs|css|json)$/.test(p));
  assert.ok(source.includes('study/spikes/xr-support.ts') && source.includes('docs/project/tasks.json'));
  const result = spawnSync('git', ['-c', `core.excludesfile=${path.join(root, '.vercelignore')}`, 'check-ignore', '--no-index', '--stdin'], { cwd: root, input: source.join('\n') + '\n', encoding: 'utf8' });
  assert.equal(result.status, 1, `Build sources are excluded: ${result.stdout}\n${result.stderr}`);
});

test('build identity permits only declared Vercel omissions and still detects real source changes', async () => {
  const temp = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(temp, 'punchcap-build-identity-'));
  const script = fileURLToPath(new URL('./stamp-build.mjs', import.meta.url));
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    await fs.writeFile(path.join(root, '.gitignore'), '.env*\n!.env.example\n/public/study/build.json\n');
    await fs.writeFile(path.join(root, '.vercelignore'), 'README.md\n.env*\n');
    await fs.writeFile(path.join(root, 'README.md'), 'Public instructions');
    await fs.writeFile(path.join(root, '.env.example'), 'PUBLIC_EXAMPLE=1');
    await fs.writeFile(path.join(root, 'source.ts'), 'export const value = 1;');
    const configuration = { framework: 'nextjs', outputDirectory: '.next-lab' };
    await fs.writeFile(path.join(root, 'vercel.json'), JSON.stringify(configuration, null, 2) + '\n');
    git(['init', '--quiet']); git(['add', '.']);
    git(['-c', 'user.name=Build Test', '-c', 'user.email=build-test@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
    const revision = git(['rev-parse', 'HEAD']);
    const stamp = async (provider: boolean, expected = revision) => {
      execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, VERCEL: provider ? '1' : '0', VERCEL_GIT_COMMIT_SHA: expected }, stdio: 'pipe' });
      return JSON.parse(await fs.readFile(path.join(root, 'public/study/build.json'), 'utf8')) as { revision: string; dirty: boolean };
    };
    assert.equal((await stamp(false)).dirty, false);
    await fs.unlink(path.join(root, 'README.md')); await fs.unlink(path.join(root, '.env.example'));
    assert.equal((await stamp(false)).dirty, true);
    assert.equal((await stamp(true)).dirty, false);
    assert.equal((await stamp(true, 'b'.repeat(40))).dirty, true);
    await fs.writeFile(path.join(root, 'vercel.json'), JSON.stringify({ outputDirectory: '.next-lab', framework: 'nextjs' }));
    assert.equal((await stamp(true)).dirty, false);
    await fs.writeFile(path.join(root, 'vercel.json'), JSON.stringify({ ...configuration, outputDirectory: 'wrong' }));
    assert.equal((await stamp(true)).dirty, true);
    await fs.writeFile(path.join(root, 'vercel.json'), JSON.stringify(configuration, null, 2) + '\n');
    await fs.writeFile(path.join(root, 'source.ts'), 'export const value = 2;');
    assert.equal((await stamp(true)).dirty, true);
    await fs.writeFile(path.join(root, 'source.ts'), 'export const value = 1;');
    await fs.writeFile(path.join(root, 'untracked.ts'), 'export {};');
    assert.equal((await stamp(true)).dirty, true);
  } finally {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  }
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
  const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { outputDirectory?: string; installCommand?: string };
  assert.equal(vercel.outputDirectory, lab.build, 'Vercel must collect the same directory that the application builds');
  assert.equal(vercel.installCommand, 'npm ci', 'Cloud installs must preserve the checked lockfile');
});
