import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: root, env: { ...process.env, PUNCHCAP_BUILD_TARGET: 'pages', NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit',
});
if (run.status !== 0) process.exit(run.status ?? 1);
const source = path.join(root, '.next-pages'), target = path.resolve(root, 'output/github-pages');
// Only replace this fixed generated artifact directory inside the workspace.
if (path.relative(root, target) !== path.join('output', 'github-pages')) throw new Error('Unsafe artifact path');
const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
if (!html.includes('开发进度看板') || !html.includes('/VRStandup/_next/') || !html.includes('https://vr-standup.vercel.app')) throw new Error('Pages export is not the expected dashboard or uses invalid asset paths');
await fs.rm(target, { recursive: true, force: true }); await fs.mkdir(target, { recursive: true });
// Publish the dashboard and its runtime assets only, never the public/media tree or application routes.
for (const entry of await fs.readdir(source, { withFileTypes: true })) {
  if (entry.isSymbolicLink()) throw new Error('Export contains an unexpected symbolic link');
  if (entry.name === '_next' || entry.isFile() && /^(?:index\.|404\.|__next\.)/.test(entry.name)) await fs.cp(path.join(source, entry.name), path.join(target, entry.name), { recursive: true, dereference: false });
}
await fs.writeFile(path.join(target, '.nojekyll'), '');
await fs.writeFile(path.join(target, 'version.json'), JSON.stringify({ source: process.env.GITHUB_SHA ?? 'local-preview', updatedAt: JSON.parse(await fs.readFile(path.join(root, 'docs/project/tasks.json'), 'utf8')).updatedAt }) + '\n');
console.log('GitHub Pages dashboard ready: output/github-pages');
