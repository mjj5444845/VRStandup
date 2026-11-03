import type { MediaContext } from './execution';
import { assert, date, finite, id, object, text } from './validation';
export const MEASUREMENT_AUDIO_BYTES = 32 * 1024 * 1024; // Per-segment engineering limit, not a study duration.
export type AudioMarker = { elapsedMs: number; context: MediaContext; mediaMs: number };
export type MeasurementAudio = { schema: 'punchcap-measurement-audio-v1'; id: string; sessionId: string; participantId: string; round: number; clipId: string; mime: string; source: 'microphone' | 'synthetic-test'; startedAt: string; stoppedAt: string; reason: string; markers: AudioMarker[]; bytes: number; sha256: string };
export type AudioUpload = Omit<MeasurementAudio, 'bytes' | 'sha256'>;
export function validateAudioUpload(value: unknown): AudioUpload {
  assert(object(value) && value.schema === 'punchcap-measurement-audio-v1' && id(value.id) && id(value.sessionId) && id(value.participantId) && Number.isInteger(value.round) && finite(value.round) && value.round >= 0 && value.round < 4 && id(value.clipId)
    && ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/wav'].includes(String(value.mime)) && ['microphone', 'synthetic-test'].includes(String(value.source)) && date(value.startedAt) && date(value.stoppedAt) && Date.parse(value.stoppedAt) >= Date.parse(value.startedAt) && Date.parse(value.stoppedAt) - Date.parse(value.startedAt) <= 1800000 && text(value.reason, 300) && Array.isArray(value.markers) && value.markers.length > 0 && value.markers.length <= 1000, '实验录音元数据无效。');
  let previous = -1;
  for (const m of value.markers) {
    assert(object(m) && finite(m.elapsedMs) && m.elapsedMs >= previous && m.elapsedMs <= 1800000 && finite(m.mediaMs) && m.mediaMs >= 0 && object(m.context) && m.context.round === value.round && id(m.context.clipId) && ['practice', 'main', 'response'].includes(String(m.context.phase)) && Number.isInteger(m.context.response) && finite(m.context.response) && m.context.response >= 0 && m.context.response <= 2, '实验录音时间标记无效。'); previous = m.elapsedMs;
  }
  return value as AudioUpload;
}
export function validateMeasurementAudio(value: unknown): MeasurementAudio {
  validateAudioUpload(value); assert(object(value) && Number.isSafeInteger(value.bytes) && finite(value.bytes) && value.bytes > 0 && value.bytes <= MEASUREMENT_AUDIO_BYTES && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256), '实验录音文件校验信息无效。'); return value as MeasurementAudio;
}
