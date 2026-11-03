import fs from 'node:fs/promises';
import path from 'node:path';
import { base64Bytes, readRecording, validateRecording, waveBytes, RECORDING_FILE_BYTES, type RecordedTake } from '../core/recording';
import { validateManifest, type ClipManifest } from '../core/materials';
import { assert, object } from '../core/validation';
import { child, newDirectory, privateRoot, regularFile, sha256 } from './private-files';
export type ClipMetadata = Pick<ClipManifest, 'id' | 'actorId' | 'kind' | 'model' | 'cues' | 'approval' | 'sync'>;
export function readTake(value: unknown): RecordedTake {
  return readRecording(value);
}
export function prepareBundle(input: unknown, meta: ClipMetadata) {
  const take = readTake(input), wave = waveBytes(take), motion = JSON.stringify(take, (key, value: unknown) => key === 'wavBase64' ? undefined : value);
  const manifest = validateManifest({ ...meta, schema: 'punchcap-clip-v1', takeId: take.id, durationMs: take.durationMs, source: take.source === 'device-capture' ? 'device' : 'synthetic', interrupted: take.interrupted,
    files: { motion: { name: 'motion.json', sha256: sha256(motion) }, audio: { name: 'audio.wav', sha256: sha256(wave), sampleRate: take.audio.sampleRate, frames: take.audio.frames } } });
  return { manifest, motion, wave };
}
export async function saveBundle(root: string, input: unknown, meta: ClipMetadata) {
  const bundle = prepareBundle(input, meta);
  await newDirectory(root, bundle.manifest.id, async stage => {
    await fs.writeFile(path.join(stage, 'motion.json'), bundle.motion, { flag: 'wx', mode: 0o600 });
    await fs.writeFile(path.join(stage, 'audio.wav'), bundle.wave, { flag: 'wx', mode: 0o600 });
    await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2), { flag: 'wx', mode: 0o600 });
  }); return bundle.manifest;
}
export async function readBundle(root: string, clipId: string) {
  const dir = await child(root, clipId);
  assert((await fs.lstat(dir)).isDirectory() && (await fs.realpath(dir)).toLowerCase() === dir.toLowerCase(), '素材目录不能是链接或普通文件。');
  const manifest = validateManifest(JSON.parse((await regularFile(path.join(dir, 'manifest.json'), 2 * 1024 * 1024)).toString('utf8')));
  assert(manifest.id === clipId, '素材目录和片段编号不一致。');
  const [motion, wave] = await Promise.all([regularFile(path.join(dir, 'motion.json'), RECORDING_FILE_BYTES), regularFile(path.join(dir, 'audio.wav'), RECORDING_FILE_BYTES)]);
  assert(sha256(motion) === manifest.files.motion.sha256 && sha256(wave) === manifest.files.audio.sha256, '素材校验值不符，可能损坏或被更改。');
  const data: unknown = JSON.parse(motion.toString('utf8')); assert(object(data) && object(data.audio), '动作文件结构无效。');
  const take = validateRecording({ ...data, audio: { ...data.audio, wavBase64: base64Bytes(wave) } });
  assert(take.id === manifest.takeId && take.durationMs === manifest.durationMs && take.interrupted === manifest.interrupted && (take.source === 'device-capture' ? 'device' : 'synthetic') === manifest.source, '素材清单与原始数据不一致。');
  return { manifest, take, motion, wave };
}
export async function listBundles(root: string) {
  await privateRoot(root); const result: { id: string; valid: boolean; manifest?: ClipManifest; error?: string }[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) { if (entry.name.startsWith('.')) continue; try { const b = await readBundle(root, entry.name); result.push({ id: entry.name, valid: true, manifest: b.manifest }); } catch (error) { result.push({ id: entry.name, valid: false, error: error instanceof Error ? error.message : '校验失败' }); } }
  return result;
}
