import { assert, finite, id, object, text } from './validation';
import { sampleRecording, type RecordedTake } from './recording';
import type { ClipManifest } from './materials';
export type SyncObservations = { schema: 'punchcap-sync-observations-v1'; takeId: string; method: string; observations: { id: string; motionMs: number; audioMs: number; uncertaintyMs: number }[] };
export function summarizeSync(value: unknown) {
  assert(object(value) && value.schema === 'punchcap-sync-observations-v1' && id(value.takeId) && text(value.method) && Array.isArray(value.observations) && value.observations.length >= 3 && value.observations.length <= 1000, '同步测量至少需要三次独立标记和明确测法。');
  const ids = new Set<string>();
  for (const o of value.observations) { assert(object(o) && id(o.id) && !ids.has(o.id) && finite(o.motionMs) && finite(o.audioMs) && o.motionMs >= 0 && o.audioMs >= 0 && finite(o.uncertaintyMs) && o.uncertaintyMs >= 0, '同步标记时间或不确定度无效。'); ids.add(o.id); }
  const data = value as SyncObservations, offsets = data.observations.map(o => o.audioMs - o.motionMs).sort((a, b) => a - b), n = offsets.length;
  const offsetMs = n % 2 ? offsets[(n - 1) / 2] : (offsets[n / 2 - 1] + offsets[n / 2]) / 2;
  const residuals = data.observations.map(o => ({ id: o.id, residualMs: o.audioMs - o.motionMs - offsetMs, uncertaintyMs: o.uncertaintyMs }));
  return { schema: 'punchcap-sync-summary-v1', takeId: data.takeId, method: data.method, offsetMs, uncertaintyMs: Math.max(...residuals.map(r => Math.abs(r.residualMs) + r.uncertaintyMs)), residuals, researchAccepted: false as const };
}
/** Positive offset means the motion event occurs later on the audio timeline. Raw data stay unchanged. */
export function samplePrepared(take: RecordedTake, manifest: ClipManifest, audioMs: number) {
  assert(take.id === manifest.takeId && take.durationMs === manifest.durationMs, '动作原件与片段清单不匹配。');
  return sampleRecording(take, audioMs - manifest.sync.offsetMs);
}
