import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { publicAssetList } from '../core/public-assets';
import { assert, object } from '../core/validation';

const ASSETS = 'public/study/club/v1';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Read only public deployment URLs. Never disable TLS verification or send credentials. */
export async function verifySystem(root: string, remote?: { url: string; revision: string }) {
  const manifestBytes = await fs.readFile(path.join(root, ASSETS, 'manifest.json'));
  const entries = publicAssetList(JSON.parse(manifestBytes.toString('utf8')));
  let origin: string | undefined;
  if (remote) {
    const url = new URL(remote.url);
    assert(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, '线上核验必须使用无凭据的HTTPS站点根地址。');
    assert(/^[a-f0-9]{40}$/.test(remote.revision), '必须提供预期的完整Git提交编号。');
    origin = url.origin;
  }
  async function read(urlPath: string, maxBytes: number) {
    const response = await fetch(`${origin}${urlPath}`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000) });
    assert(response.ok, `HTTP ${response.status}：${urlPath}`);
    assert(response.body, `响应为空：${urlPath}`);
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; assert(bytes <= maxBytes, `响应超过预期大小：${urlPath}`); chunks.push(part.value); }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  }
  let build: unknown = null;
  if (remote) {
    build = JSON.parse((await read('/study/build.json', 16384)).toString('utf8'));
    assert(object(build) && build.revision === remote.revision && build.dirty === false, '线上版本不是预期提交，或构建标记包含未提交变更。');
    const served = await read('/study/club/v1/manifest.json', manifestBytes.length);
    assert(hash(served) === hash(manifestBytes), '线上素材清单与本机不同。');
  }
  const files = [];
  for (const entry of entries) {
    const local = await fs.readFile(path.join(root, ASSETS, entry.file));
    assert(local.length === entry.bytes && hash(local) === entry.sha256, `本机素材不符：${entry.file}`);
    if (remote) { const served = await read(`/study/club/v1/${entry.file}`, entry.bytes); assert(served.length === entry.bytes && hash(served) === entry.sha256, `线上素材不符：${entry.file}`); }
    files.push({ file: entry.file, bytes: entry.bytes, sha256: entry.sha256 });
  }
  const routes = [];
  if (remote) for (const route of ['/study/demo', '/study/scene-review', '/study/device', '/lab/captions']) {
    const html = await read(route, 2 * 1024 * 1024);
    assert(html.toString('utf8').includes('<html'), `入口不是HTML：${route}`); routes.push(route);
  }
  return { checkedAt: new Date().toISOString(), scope: remote ? 'deployed-public-system' : 'local-public-assets', build, files, totalBytes: files.reduce((sum, f) => sum + f.bytes, 0), routes, passed: true };
}
export async function systemVerifyCommand(args: string[], root = process.cwd()) {
  assert(args.length === 0 || args.length === 4 && args[0] === '--url' && args[2] === '--revision', '用法：npm run system:verify；线上追加 -- --url https://站点 --revision 完整提交编号。');
  return verifySystem(root, args.length ? { url: args[1], revision: args[3] } : undefined);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void systemVerifyCommand(process.argv.slice(2)).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(JSON.stringify({ passed: false, error: error instanceof Error ? error.message : '系统核验失败', cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined })); process.exitCode = 1; });
