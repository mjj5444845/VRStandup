import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, id, object } from '../core/validation';
import { newDirectory, privateRoot, regularFile, sha256 } from './private-files';
type BackupManifest = { schema: 'punchcap-backup-v1'; sessionId: string; files: { name: string; sha256: string }[] };
export async function verifyBackup(directory: string) {
  const source = await privateRoot(directory), raw: unknown = JSON.parse((await regularFile(path.join(source, 'backup-manifest.json'), 8 * 1024 * 1024)).toString());
  assert(object(raw) && raw.schema === 'punchcap-backup-v1' && id(raw.sessionId) && Array.isArray(raw.files) && raw.files.length > 0 && raw.files.length <= 100000, '备份清单无效。');
  const names = new Set<string>();
  for (const f of raw.files) { assert(object(f) && typeof f.name === 'string' && f.name !== 'backup-manifest.json' && f.name.length < 500 && f.name.split('/').every(part => part !== '.' && part !== '..' && /^[a-zA-Z0-9_.-]+$/.test(part)) && !names.has(f.name.toLowerCase()) && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256), '备份路径或校验值无效。'); names.add(f.name.toLowerCase()); }
  const manifest = raw as BackupManifest, actual: string[] = [];
  async function walk(dir: string, prefix = '') { for (const item of await fs.readdir(dir, { withFileTypes: true })) { assert(!item.isSymbolicLink(), '备份拒绝链接。'); const name = prefix + item.name; if (item.isDirectory()) await walk(path.join(dir, item.name), name + '/'); else { assert(item.isFile(), '备份存在非普通文件。'); if (name !== 'backup-manifest.json') actual.push(name); } } }
  await walk(source); assert(actual.length === manifest.files.length && actual.every(n => names.has(n.toLowerCase())), '备份文件与清单不一致。');
  for (const file of manifest.files) assert(sha256(await regularFile(path.join(source, file.name), 256 * 1024 * 1024)) === file.sha256, `备份校验失败：${file.name}`);
  return { source, manifest, verified: true as const, independentStorageVerified: false as const };
}
/** Restore only into a new session directory; never merge with or overwrite existing records. */
export async function restoreBackup(directory: string, destination: string) {
  const checked = await verifyBackup(directory), target = await privateRoot(destination), relative = path.relative(checked.source, target);
  assert(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), '恢复目标不能位于备份内部。');
  const restored = await newDirectory(target, checked.manifest.sessionId, async stage => {
    for (const file of checked.manifest.files) { const bytes = await regularFile(path.join(checked.source, file.name), 256 * 1024 * 1024); assert(sha256(bytes) === file.sha256, '恢复期间备份发生变化。'); const output = path.join(stage, file.name); await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, bytes, { flag: 'wx', mode: 0o600 }); }
  });
  return { sessionId: checked.manifest.sessionId, directory: restored, files: checked.manifest.files.length, verified: true, independentStorageVerified: false };
}
