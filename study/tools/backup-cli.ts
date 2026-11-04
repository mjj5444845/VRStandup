import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreBackup, verifyBackup } from '../storage/backup';
export async function backupCommand(args: string[]) {
  const [command, source, destination, ...extra] = args;
  if (!source || extra.length || command !== 'verify' && command !== 'restore' || command === 'restore' && !destination || command === 'verify' && destination) throw new Error('用法：backup verify 备份目录；backup restore 备份目录 新的私密会话根目录。');
  if (command === 'verify') { const r = await verifyBackup(path.resolve(source)); return { sessionId: r.manifest.sessionId, files: r.manifest.files.length, verified: r.verified, independentStorageVerified: r.independentStorageVerified }; }
  return restoreBackup(path.resolve(source), path.resolve(destination!));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void backupCommand(process.argv.slice(2)).then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error instanceof Error ? error.message : '备份处理失败'); process.exitCode = 1; });
