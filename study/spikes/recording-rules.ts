import { interpolateOrientation, type Pose, type Quat, type Vec3 } from './replay-rules';

// Memory and review limits for this disposable capture spike, not study thresholds.
export const RECORDING_SECONDS = 15;
export const RECORDING_FILE_BYTES = 12 * 1024 * 1024;
// Engineering interruption guard, not a motion/audio synchronization criterion.
export const MAX_RECORDING_FRAME_GAP_MS = 250;
export type CapturedPose = Pose & { emulatedPosition: boolean };
export type CapturedFrame = {
  tMs: number; predictedDisplayTimeMs: number; observedPerformanceTimeMs: number;
  head: CapturedPose | null; leftHand: CapturedPose | null; rightHand: CapturedPose | null;
  leftSource: string | null; rightSource: string | null;
};
export type Calibration = { origin: Vec3; yaw: number; headHeight: number };
export type InputDevice = { id: string; handedness: 'left' | 'right' | 'none'; kind: 'controller' | 'hand'; profiles: string[] };
export type RecordedTake = {
  schema: 'punchcap-recording-check-v1'; source: 'device-capture' | 'test-fixture'; id: string; createdAt: string; browser: string;
  referenceSpace: 'local-floor'; coordinates: 'right-handed-y-up-metres';
  durationMs: number; calibration: Calibration; frames: CapturedFrame[]; devices: InputDevice[];
  interrupted: boolean; stopReason: string;
  events: { tMs: number; type: string; detail: string }[];
  audio: {
    clock: 'audio-context-pcm-frames'; sampleRate: number; frames: number; startContextFrame: number;
    wavBase64: string; baseLatencySeconds: number | null;
    processing: { echoCancellation: boolean | null; noiseSuppression: boolean | null; autoGainControl: boolean | null };
  };
};
export function hasRecordingFrameGap(frames: readonly Pick<CapturedFrame, 'tMs'>[], durationMs: number): boolean {
  return frames.length < 2 || frames[0].tMs > MAX_RECORDING_FRAME_GAP_MS
    || durationMs - frames[frames.length - 1].tMs > MAX_RECORDING_FRAME_GAP_MS
    || frames.some((frame, i) => i > 0 && frame.tMs - frames[i - 1].tMs > MAX_RECORDING_FRAME_GAP_MS);
}
const joints = ['head', 'leftHand', 'rightHand'] as const;
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function tuple(value: unknown, length: number): value is number[] { return Array.isArray(value) && value.length === length && value.every(finite); }
function pose(value: unknown): value is CapturedPose | null {
  return value === null || (object(value) && tuple(value.position, 3) && tuple(value.orientation, 4)
    && Math.abs(Math.hypot(...value.orientation) - 1) < 0.001 && typeof value.emulatedPosition === 'boolean');
}

export function makeCalibration(head: Pose): Calibration {
  const [x, y, z, w] = head.orientation;
  const forwardX = -2 * (x * z + w * y), forwardZ = -(1 - 2 * (x * x + y * y));
  if (Math.hypot(forwardX, forwardZ) < 0.1) throw new Error('请平视舞台正前方后重新校准。');
  return { origin: [head.position[0], 0, head.position[2]], yaw: Math.atan2(-forwardX, -forwardZ), headHeight: head.position[1] };
}
export function calibratedPose(p: Pose, calibration: Calibration): Pose {
  const dx = p.position[0] - calibration.origin[0], dz = p.position[2] - calibration.origin[2];
  const c = Math.cos(calibration.yaw), s = Math.sin(calibration.yaw);
  const [x, y, z, w] = p.orientation, a = Math.sin(-calibration.yaw / 2), b = Math.cos(-calibration.yaw / 2);
  const orientation: Quat = [b * x + a * z, b * y + a * w, b * z - a * x, b * w - a * y];
  return { position: [c * dx - s * dz, p.position[1], s * dx + c * dz], orientation };
}

export function pcmWave(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || !samples.every(Number.isFinite)) throw new Error('录音采样无效。');
  const data = new Uint8Array(44 + samples.length * 2), view = new DataView(data.buffer);
  const word = (offset: number, text: string) => { [...text].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0))); };
  word(0, 'RIFF'); view.setUint32(4, data.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const v = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, Math.round(v * (v < 0 ? 32768 : 32767)), true); });
  return data;
}
export function base64Bytes(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
export function waveBytes(take: RecordedTake): Uint8Array { return Uint8Array.from(atob(take.audio.wavBase64), (letter) => letter.charCodeAt(0)); }

/** Validate an untrusted local file before decoding audio or allocating scene objects. */
export function validateRecording(value: unknown): RecordedTake {
  const fail = () => { throw new Error('录制检查文件无效或不完整，请使用本页导出的文件。'); };
  if (!object(value) || value.schema !== 'punchcap-recording-check-v1' || !['device-capture', 'test-fixture'].includes(String(value.source)) || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id)
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.browser !== 'string' || value.browser.length > 1000
    || value.referenceSpace !== 'local-floor' || value.coordinates !== 'right-handed-y-up-metres'
    || !finite(value.durationMs) || value.durationMs <= 0 || value.durationMs > RECORDING_SECONDS * 1000
    || typeof value.interrupted !== 'boolean' || typeof value.stopReason !== 'string' || value.stopReason.length > 200
    || !object(value.calibration) || !tuple(value.calibration.origin, 3) || value.calibration.origin[1] !== 0
    || !finite(value.calibration.yaw) || !finite(value.calibration.headHeight)
    || !Array.isArray(value.frames) || value.frames.length < 2 || value.frames.length > 12000
    || !Array.isArray(value.devices) || value.devices.length > 32 || !Array.isArray(value.events) || value.events.length > 12000
    || !object(value.audio)) return fail();
  const audio = value.audio;
  if (audio.clock !== 'audio-context-pcm-frames' || !Number.isInteger(audio.sampleRate) || !finite(audio.sampleRate) || audio.sampleRate < 8000 || audio.sampleRate > 192000
    || !Number.isInteger(audio.frames) || !finite(audio.frames) || audio.frames <= 0 || audio.frames > audio.sampleRate * RECORDING_SECONDS
    || !Number.isSafeInteger(audio.startContextFrame) || !finite(audio.startContextFrame) || audio.startContextFrame < 0
    || Math.abs(value.durationMs - audio.frames / audio.sampleRate * 1000) > 1e-6
    || !(audio.baseLatencySeconds === null || (finite(audio.baseLatencySeconds) && audio.baseLatencySeconds >= 0))
    || !object(audio.processing) || !['echoCancellation', 'noiseSuppression', 'autoGainControl'].every(key => audio.processing && object(audio.processing) && (audio.processing[key] === null || typeof audio.processing[key] === 'boolean'))
    || typeof audio.wavBase64 !== 'string' || audio.wavBase64.length > RECORDING_FILE_BYTES || audio.wavBase64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(audio.wavBase64)) return fail();
  const devices = new Map<string, string>();
  for (const device of value.devices) {
    if (!object(device) || typeof device.id !== 'string' || !/^[a-zA-Z0-9-]{1,40}$/.test(device.id) || devices.has(device.id)
      || !['left', 'right', 'none'].includes(String(device.handedness)) || !['controller', 'hand'].includes(String(device.kind))
      || !Array.isArray(device.profiles) || device.profiles.length > 12 || !device.profiles.every(p => typeof p === 'string' && p.length <= 120)) return fail();
    devices.set(device.id, String(device.handedness));
  }
  let previous = -1;
  for (const frame of value.frames) {
    if (!object(frame) || !finite(frame.tMs) || frame.tMs < 0 || frame.tMs <= previous || frame.tMs > value.durationMs
      || !finite(frame.predictedDisplayTimeMs) || !finite(frame.observedPerformanceTimeMs) || !joints.every(j => pose(frame[j]))) return fail();
    for (const side of ['left', 'right'] as const) {
      const source = frame[`${side}Source`];
      if (source !== null && (typeof source !== 'string' || devices.get(source) !== side)) return fail();
      if (frame[`${side}Hand`] !== null && source === null) return fail();
    }
    previous = frame.tMs;
  }
  previous = -1;
  for (const event of value.events) {
    if (!object(event) || !finite(event.tMs) || event.tMs < previous || event.tMs < 0 || event.tMs > value.durationMs
      || typeof event.type !== 'string' || event.type.length > 60 || typeof event.detail !== 'string' || event.detail.length > 200) return fail();
    previous = event.tMs;
  }
  if ((value.stopReason === 'limit' && value.durationMs !== RECORDING_SECONDS * 1000)
    || (!value.interrupted && (hasRecordingFrameGap(value.frames as CapturedFrame[], value.durationMs)
      || value.events.some(e => object(e) && e.type === 'buffered-prefix')))) return fail();
  const take = value as RecordedTake, bytes = waveBytes(take), view = new DataView(bytes.buffer);
  const ascii = (start: number, count: number) => String.fromCharCode(...bytes.subarray(start, start + count));
  if (bytes.length !== 44 + audio.frames * 2 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE' || ascii(12, 4) !== 'fmt ' || ascii(36, 4) !== 'data'
    || view.getUint32(4, true) !== bytes.length - 8 || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1
    || view.getUint32(24, true) !== audio.sampleRate || view.getUint32(28, true) !== audio.sampleRate * 2 || view.getUint16(32, true) !== 2
    || view.getUint16(34, true) !== 16 || view.getUint32(40, true) !== audio.frames * 2) return fail();
  return take;
}

/** Never interpolate across missing poses, source replacement, or a long sampling gap. */
export function sampleRecording(take: RecordedTake, timeMs: number): Record<typeof joints[number], Pose | null> {
  const empty = { head: null, leftHand: null, rightHand: null };
  if (!Number.isFinite(timeMs)) throw new Error('回放时间无效。');
  const frames = take.frames;
  if (timeMs < frames[0].tMs || timeMs > frames[frames.length - 1].tMs) return empty;
  let lo = 0, hi = frames.length - 1;
  while (lo + 1 < hi) { const mid = Math.floor((lo + hi) / 2); if (frames[mid].tMs <= timeMs) lo = mid; else hi = mid; }
  const a = frames[lo], b = frames[hi];
  const sample = (joint: typeof joints[number]): Pose | null => {
    let p: Pose | null = null;
    if (timeMs === a.tMs) p = a[joint];
    else if (timeMs === b.tMs) p = b[joint];
    else if (a[joint] && b[joint] && b.tMs - a.tMs <= MAX_RECORDING_FRAME_GAP_MS
      && (joint === 'head' || a[joint === 'leftHand' ? 'leftSource' : 'rightSource'] === b[joint === 'leftHand' ? 'leftSource' : 'rightSource'])) {
      const ratio = (timeMs - a.tMs) / (b.tMs - a.tMs), start = a[joint]!, end = b[joint]!;
      p = { position: [start.position[0] + (end.position[0] - start.position[0]) * ratio, start.position[1] + (end.position[1] - start.position[1]) * ratio, start.position[2] + (end.position[2] - start.position[2]) * ratio], orientation: interpolateOrientation(start.orientation, end.orientation, ratio) };
    }
    return p ? calibratedPose(p, take.calibration) : null;
  };
  return { head: sample('head'), leftHand: sample('leftHand'), rightHand: sample('rightHand') };
}
