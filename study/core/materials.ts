import { assert, date, finite, id, object, text, tuple } from './validation';
import { JOINTS, type Joint, type Vec3 } from './motion';
export type Approval = { status: 'draft' | 'approved'; reviewer: string; reviewedAt: string; basis: string };
export type Mapping = {
  id: string; modelId: string; modelVersion: string; heightMetres: number;
  nodes: Record<Joint, string>; offsets: Record<Joint, Vec3>; approval: Approval;
};
export type Cue = { id: string; atMs: number; kind: 'laugh' | 'expressive' | 'distancing' | 'response-window' | 'pause'; endMs: number; anchor: Joint | 'stage'; offset: Vec3; assetId: string; throwable: boolean };
export type ClipManifest = {
  schema: 'punchcap-clip-v1'; id: string; actorId: string; kind: 'main' | 'response' | 'practice'; takeId: string; durationMs: number;
  model: Mapping; source: 'device' | 'synthetic'; interrupted: boolean;
  files: { motion: { name: 'motion.json'; sha256: string }; audio: { name: 'audio.wav'; sha256: string; sampleRate: number; frames: number } };
  cues: Cue[]; approval: Approval;
  sync: { status: 'unmeasured' | 'measured'; offsetMs: number; uncertaintyMs: number | null; method: string; approval: Approval };
};
export const DRAFT: Approval = { status: 'draft', reviewer: '', reviewedAt: '', basis: '' };
export function validateApproval(value: unknown): Approval {
  assert(object(value) && ['draft', 'approved'].includes(String(value.status)) && typeof value.reviewer === 'string' && typeof value.reviewedAt === 'string' && typeof value.basis === 'string', '审核记录无效。');
  assert(value.status === 'draft' || (id(value.reviewer) && date(value.reviewedAt) && text(value.basis)), '已审核项目必须记录审核者、日期和依据。');
  return value as Approval;
}
export function validateMapping(value: unknown): Mapping {
  assert(object(value) && id(value.id) && id(value.modelId) && id(value.modelVersion) && finite(value.heightMetres) && value.heightMetres > 0 && value.heightMetres <= 10 && object(value.nodes) && object(value.offsets), '模型映射、版本或米制高度无效。');
  const nodes = value.nodes, offsets = value.offsets;
  assert(JOINTS.every(j => text(nodes[j], 120) && tuple(offsets[j], 3)) && new Set(Object.values(nodes)).size === 3, '模型头部和左右手映射必须明确且不能重复。');
  validateApproval(value.approval); return value as Mapping;
}
export function validateCues(input: unknown, durationMs: number): Cue[] {
  assert(Array.isArray(input) && input.length <= 10000, '时间线格式无效。');
  const ids = new Set<string>();
  for (const cue of input) {
    assert(object(cue) && id(cue.id) && !ids.has(cue.id) && finite(cue.atMs) && finite(cue.endMs) && cue.atMs >= 0 && cue.endMs >= cue.atMs && cue.endMs <= durationMs
      && ['laugh', 'expressive', 'distancing', 'response-window', 'pause'].includes(String(cue.kind)) && [...JOINTS, 'stage'].includes(String(cue.anchor)) && tuple(cue.offset, 3) && typeof cue.assetId === 'string' && (cue.assetId === '' || id(cue.assetId)) && typeof cue.throwable === 'boolean', '时间线编号、区间或锚点无效。');
    assert(cue.kind !== 'expressive' || !cue.throwable, '写意花字不能投掷。'); ids.add(cue.id);
  }
  const cues = input as Cue[];
  const captions = cues.filter(c => c.kind === 'expressive' || c.kind === 'distancing');
  for (const c of captions) {
    assert(c.endMs > c.atMs && c.endMs - c.atMs <= 5000, '花字生存时间必须大于零且不超过 5000 毫秒。');
    assert(!cues.some(p => p.kind === 'pause' && c.atMs < p.endMs && c.endMs > p.atMs), '花字不能覆盖包袱前停顿。');
    if (c.kind === 'distancing') assert(cues.some(l => l.kind === 'laugh' && c.atMs - l.atMs >= 500 && c.atMs - l.atMs <= 2000), '间离花字需在笑声开始后 500–2000 毫秒出现。');
  }
  const edges = captions.flatMap(c => [{ t: c.atMs, n: 1 }, { t: c.endMs, n: -1 }]).sort((a, b) => a.t - b.t || a.n - b.n);
  let visible = 0; for (const e of edges) { visible += e.n; assert(visible <= 2, '同屏花字不能超过两个。'); }
  return cues;
}
export function validateManifest(value: unknown): ClipManifest {
  assert(object(value) && value.schema === 'punchcap-clip-v1' && id(value.id) && id(value.actorId) && id(value.takeId) && ['main', 'response', 'practice'].includes(String(value.kind))
    && finite(value.durationMs) && value.durationMs > 0 && value.durationMs <= 180000 && ['device', 'synthetic'].includes(String(value.source)) && typeof value.interrupted === 'boolean' && object(value.files), '片段清单格式无效。');
  validateMapping(value.model); validateApproval(value.approval); validateCues(value.cues, value.durationMs);
  const files = value.files;
  assert(object(files.motion) && files.motion.name === 'motion.json' && typeof files.motion.sha256 === 'string' && /^[a-f0-9]{64}$/.test(files.motion.sha256)
    && object(files.audio) && files.audio.name === 'audio.wav' && typeof files.audio.sha256 === 'string' && /^[a-f0-9]{64}$/.test(files.audio.sha256)
    && finite(files.audio.sampleRate) && Number.isInteger(files.audio.sampleRate) && files.audio.sampleRate >= 8000 && files.audio.sampleRate <= 192000
    && Number.isSafeInteger(files.audio.frames) && finite(files.audio.frames) && files.audio.frames > 0 && Math.abs(files.audio.frames / files.audio.sampleRate * 1000 - value.durationMs) < 1e-6, '音频/动作文件校验值或时长不一致。');
  assert(object(value.sync) && ['unmeasured', 'measured'].includes(String(value.sync.status)) && finite(value.sync.offsetMs) && Math.abs(value.sync.offsetMs) < value.durationMs
    && (value.sync.uncertaintyMs === null || (finite(value.sync.uncertaintyMs) && value.sync.uncertaintyMs >= 0)) && typeof value.sync.method === 'string', '同步测量说明无效。');
  validateApproval(value.sync.approval);
  assert(value.sync.status !== 'measured' || (text(value.sync.method) && finite(value.sync.uncertaintyMs)), '已测同步必须提供测法与不确定度。');
  return value as ClipManifest;
}
export function studyMaterialIssues(manifest: ClipManifest): string[] {
  const problems: string[] = [];
  if (manifest.source !== 'device') problems.push('工程样例不能作为正式演员素材');
  if (manifest.interrupted) problems.push('录制有中断');
  if (manifest.approval.status !== 'approved') problems.push('片段未审核');
  if (manifest.model.approval.status !== 'approved') problems.push('模型映射未审核');
  if (manifest.sync.status !== 'measured' || manifest.sync.approval.status !== 'approved') problems.push('物理同步未测量并确认');
  return problems;
}
export function compatibleResponse(main: ClipManifest, response: ClipManifest): boolean {
  return response.kind === 'response' && main.actorId === response.actorId && main.model.modelId === response.model.modelId && main.model.modelVersion === response.model.modelVersion && main.model.id === response.model.id && main.model.heightMetres === response.model.heightMetres;
}
