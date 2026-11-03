import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoPlan, REFERENCE_MAPPING } from '../core/demo';
import { DRAFT, validateManifest } from '../core/materials';
import { summarizeSync } from '../core/sync';
import { syntheticTake } from '../core/synthetic-take';
import { listBundles, readBundle, saveBundle, type ClipMetadata } from '../storage/assets';
import { privateRoot, regularFile } from '../storage/private-files';
import { RECORDING_FILE_BYTES } from '../core/recording';
export async function seedRehearsal(root: string) {
  const plan = demoPlan();
  for (const item of plan.clips) {
    const meta: ClipMetadata = { id: item.id, actorId: item.actorId, kind: item.kind, model: item.model, cues: item.cues, approval: item.approval, sync: item.sync };
    try { item.files = (await readBundle(root, item.id)).manifest.files; }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; item.files = (await saveBundle(root, syntheticTake(item.id), meta)).files; }
  }
  return plan;
}
async function main(args: string[]) {
  const [command, ...flags] = args, values = new Map<string, string>();
  for (let i = 0; i < flags.length; i += 2) { if (!['--root', '--input', '--metadata', '--output'].includes(flags[i]) || !flags[i + 1]) throw new Error('参数需为 --root/--input/--metadata/--output 加路径。'); values.set(flags[i], flags[i + 1]); }
  const root = path.resolve(values.get('--root') ?? 'local_assets/performances');
  if (command === 'verify') { const result = await listBundles(root); console.log(JSON.stringify(result.map(x => ({ id: x.id, valid: x.valid, error: x.error })), null, 2)); if (result.some(x => !x.valid)) process.exitCode = 1; }
  else if (command === 'rehearsal') {
    const plan = await seedRehearsal(root), output = path.resolve(values.get('--output') ?? 'local_assets/config/rehearsal-plan.json');
    await privateRoot(path.dirname(output)); await fs.writeFile(output, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o600 }); console.log(`已生成工程预演素材与草稿配置：${output}。不作为正式研究素材。`);
  } else if (command === 'prepare') {
    if (!values.has('--input') || !values.has('--metadata')) throw new Error('请提供 --input 原件和 --metadata 元数据 JSON。');
    const input: unknown = JSON.parse((await regularFile(values.get('--input')!, RECORDING_FILE_BYTES)).toString('utf8')), meta = JSON.parse((await regularFile(values.get('--metadata')!, 2 * 1024 * 1024)).toString('utf8')) as ClipMetadata;
    const manifest = await saveBundle(root, input, meta); console.log(JSON.stringify({ id: manifest.id, durationMs: manifest.durationMs, interrupted: manifest.interrupted, source: manifest.source, approval: manifest.approval.status }));
  } else if (command === 'sync') {
    if (!values.has('--input') || !values.has('--output')) throw new Error('需要 --input 同步标记和 --output 报告路径。');
    const summary = summarizeSync(JSON.parse((await regularFile(values.get('--input')!, 1024 * 1024)).toString('utf8'))); await privateRoot(path.dirname(path.resolve(values.get('--output')!))); await fs.writeFile(values.get('--output')!, JSON.stringify(summary, null, 2), { flag: 'wx', mode: 0o600 }); console.log('同步偏移与残差已计算，未自动判定研究合格。');
  } else if (command === 'metadata') {
    console.log(JSON.stringify({ id: 'replace-id', actorId: 'replace-actor-id', kind: 'main', model: REFERENCE_MAPPING, cues: [], approval: DRAFT, sync: { status: 'unmeasured', offsetMs: 0, uncertaintyMs: null, method: '', approval: DRAFT } }, null, 2));
  } else throw new Error('命令：prepare / verify / rehearsal / metadata。原件和库默认仅保存在 local_assets/。');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : '素材处理失败'); process.exitCode = 1; });
export { validateManifest };
