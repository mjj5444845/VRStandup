import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAudioUpload, validateMeasurementAudio, MEASUREMENT_AUDIO_BYTES, type MeasurementAudio } from '../core/measurement';
import { canonicalJson, assert } from '../core/validation';
import { child, newDirectory, privateRoot, regularFile, sha256 } from './private-files';
export async function saveMeasurement(root: string, metadata: unknown, bytes: Uint8Array) {
  const input = validateAudioUpload(metadata); assert(bytes.length > 12 && bytes.length <= MEASUREMENT_AUDIO_BYTES, '录音文件为空或过大。');
  const wave = Buffer.from(bytes), signature = wave.subarray(0, 4).toString('hex');
  assert(input.mime.startsWith('audio/webm') ? signature === '1a45dfa3' : input.mime.startsWith('audio/ogg') ? wave.subarray(0, 4).toString() === 'OggS' : wave.subarray(0, 4).toString() === 'RIFF' && wave.subarray(8, 12).toString() === 'WAVE', '录音容器与类型不一致。');
  const value = validateMeasurementAudio({ ...input, bytes: wave.length, sha256: sha256(wave) }), audioRoot = path.join(await child(root, input.sessionId), 'measurement-audio');
  try { const prior = await readMeasurement(root, input.sessionId, input.id); assert(canonicalJson(prior.metadata) === canonicalJson(value), '相同录音编号的内容不一致。'); return prior.metadata; }
  catch (e) { if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e; }
  await newDirectory(audioRoot, input.id, async stage => { await fs.writeFile(path.join(stage, 'audio.bin'), wave, { flag: 'wx', mode: 0o600 }); await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }); return value;
}
export async function readMeasurement(root: string, sessionId: string, audioId: string) {
  const dir = await child(path.join(await child(root, sessionId), 'measurement-audio'), audioId), metadata = validateMeasurementAudio(JSON.parse((await regularFile(path.join(dir, 'manifest.json'), 256000)).toString()));
  const bytes = await regularFile(path.join(dir, 'audio.bin'), MEASUREMENT_AUDIO_BYTES); assert(metadata.id === audioId && metadata.sessionId === sessionId && metadata.bytes === bytes.length && metadata.sha256 === sha256(bytes), '实验录音校验不符。'); return { metadata, bytes };
}
export async function listMeasurements(root: string, sessionId: string) {
  const dir = path.join(await child(root, sessionId), 'measurement-audio'); let files;
  try { files = await fs.readdir(dir); } catch (e) { if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return []; throw e; }
  const out: MeasurementAudio[] = []; for (const file of files.filter(f => !f.startsWith('.'))) out.push((await readMeasurement(root, sessionId, file)).metadata); return out;
}
export async function backupSession(root: string, sessionId: string, destination: string) {
  const source = await child(root, sessionId), target = await privateRoot(destination), files: { name: string; sha256: string }[] = [];
  const relative = path.relative(source, target); assert(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), '备份位置不能在源会话内部。');
  const walk = async (dir: string, prefix = '') => { for (const item of await fs.readdir(dir, { withFileTypes: true })) { assert(!item.isSymbolicLink(), '备份拒绝链接。'); const name = prefix + item.name; if (item.isDirectory()) await walk(path.join(dir, item.name), name + '/'); else files.push({ name, sha256: sha256(await regularFile(path.join(dir, item.name), 256 * 1024 * 1024)) }); } };
  await walk(source); const id = `${sessionId}-${Date.now()}`;
  await newDirectory(target, id, async stage => { for (const file of files) { const bytes = await regularFile(path.join(source, file.name), 256 * 1024 * 1024); assert(sha256(bytes) === file.sha256, '备份期间源文件变化，请停止写入后重试。'); await fs.mkdir(path.dirname(path.join(stage, file.name)), { recursive: true }); await fs.writeFile(path.join(stage, file.name), bytes, { flag: 'wx', mode: 0o600 }); } await fs.writeFile(path.join(stage, 'backup-manifest.json'), JSON.stringify({ schema: 'punchcap-backup-v1', sessionId, files }), { flag: 'wx', mode: 0o600 }); });
  for (const file of files) assert(sha256(await regularFile(path.join(target, id, file.name), 256 * 1024 * 1024)) === file.sha256, '备份副本校验失败。'); return { id, files: files.length, verified: true, independentStorageVerified: false };
}
