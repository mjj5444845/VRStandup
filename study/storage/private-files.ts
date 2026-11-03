import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { id } from '../core/validation';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export function sha256(bytes: string | Uint8Array) { return createHash('sha256').update(bytes).digest('hex'); }
export async function privateRoot(root: string) {
  const absolute = path.resolve(root);
  for (const name of ['public', 'archive', '.git', '.agents', '.codex']) { const relative = path.relative(path.join(projectRoot, name), absolute); if (relative === '' || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error('私密资料不能写进公开目录、归档或工程内部配置目录。'); }
  const relative = path.relative(projectRoot, absolute);
  if (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !['local_assets', 'data', 'output', 'raw', 'recordings', 'backups'].includes(relative.split(path.sep)[0])) throw new Error('项目内的私密资料必须放在 local_assets、data、output 等被忽略的目录，不能混入源码。');
  await fs.mkdir(root, { recursive: true }); const real = await fs.realpath(root);
  if (real.toLowerCase() !== absolute.toLowerCase() || (await fs.lstat(root)).isSymbolicLink()) throw new Error('私密资料根目录不能通过符号链接重定向。'); return real;
}
export async function child(root: string, name: string) {
  if (!id(name)) throw new Error('文件编号无效，不能包含路径。'); const base = await privateRoot(root), target = path.join(base, name);
  try { if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('私密文件不能是符号链接。'); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  return target;
}
export async function atomicJson(file: string, value: unknown) {
  const dir = await privateRoot(path.dirname(file)), temp = path.join(dir, `.write-${randomUUID()}`);
  const h = await fs.open(temp, 'wx', 0o600); try { await h.writeFile(JSON.stringify(value, null, 2)); await h.sync(); } finally { await h.close(); }
  try { await fs.rename(temp, file); } catch (error) { await fs.rm(temp, { force: true }); throw error; }
}
export async function newDirectory(root: string, name: string, write: (stage: string) => Promise<void>) {
  const target = await child(root, name), base = await privateRoot(root), stage = await fs.mkdtemp(path.join(base, '.stage-'));
  try {
    try { await fs.lstat(target); throw new Error('该编号已存在，请使用新编号，原件不会被覆盖。'); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    await write(stage); await fs.rename(stage, target); return target;
  } finally {
    // Only remove our own verified staging directory, never a caller-supplied tree.
    if (path.dirname(stage) === base && path.basename(stage).startsWith('.stage-')) await fs.rm(stage, { recursive: true, force: true });
  }
}
export async function regularFile(file: string, maxBytes: number) {
  const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('文件无效、为链接或超出大小上限。'); return fs.readFile(file);
}
