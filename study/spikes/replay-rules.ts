export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type Pose = { position: Vec3; orientation: Quat };
export type Joint = 'head' | 'leftHand' | 'rightHand';
export type PoseFrame = { tMs: number } & Record<Joint, Pose | null>;
export type ReplayClip = {
  version: 1;
  source: 'synthetic';
  id: string;
  durationMs: number;
  coordinates: 'right-handed-y-up';
  frames: PoseFrame[];
  markersMs: number[];
};
export const JOINTS: readonly Joint[] = ['head', 'leftHand', 'rightHand'];

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function tuple(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}
function pose(value: unknown): value is Pose | null {
  if (value === null) return true;
  return record(value) && tuple(value.position, 3) && tuple(value.orientation, 4)
    && Math.abs(Math.hypot(...value.orientation) - 1) < 0.001;
}

/** Validate the experimental fixture format; this is not the real recorder schema. */
export function validateReplayClip(value: unknown): ReplayClip {
  if (!record(value) || value.version !== 1 || value.source !== 'synthetic'
    || typeof value.id !== 'string' || !value.id.trim() || value.coordinates !== 'right-handed-y-up'
    || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs <= 0
    || !Array.isArray(value.frames) || value.frames.length < 2 || value.frames.length > 10_000
    || !Array.isArray(value.markersMs)) throw new Error('测试动作片段格式无效。');
  let previous = -1;
  for (const frame of value.frames) {
    if (!record(frame) || typeof frame.tMs !== 'number' || !Number.isFinite(frame.tMs)
      || frame.tMs <= previous || frame.tMs < 0 || frame.tMs > value.durationMs
      || !JOINTS.every((joint) => pose(frame[joint]))) throw new Error('动作帧时间、位置或朝向无效。');
    previous = frame.tMs;
  }
  if (value.frames[0].tMs !== 0 || previous !== value.durationMs) throw new Error('动作必须覆盖完整片段。');
  previous = -1;
  for (const marker of value.markersMs) {
    if (typeof marker !== 'number' || !Number.isFinite(marker) || marker <= previous
      || marker <= 0 || marker >= value.durationMs) throw new Error('节拍标记必须按时间递增并位于片段内。');
    previous = marker;
  }
  return value as ReplayClip;
}

/** Take the short quaternion arc; q and -q describe the same orientation. */
export function interpolateOrientation(a: Quat, b: Quat, t: number): Quat {
  const rawDot = a.reduce((sum, n, i) => sum + n * b[i], 0);
  const sign = rawDot < 0 ? -1 : 1;
  const dot = Math.min(1, Math.abs(rawDot));
  let wa = 1 - t, wb = t;
  if (dot < 0.9995) {
    const theta = Math.acos(dot), sine = Math.sin(theta);
    wa = Math.sin((1 - t) * theta) / sine;
    wb = Math.sin(t * theta) / sine;
  }
  const result = a.map((n, i) => n * wa + b[i] * sign * wb);
  const length = Math.hypot(...result);
  return [result[0] / length, result[1] / length, result[2] / length, result[3] / length];
}

/** Missing tracking is hidden, never bridged by a fabricated pose. */
export function sampleReplay(clip: ReplayClip, timeMs: number): PoseFrame {
  if (!Number.isFinite(timeMs)) throw new Error('动作时间无效。');
  const tMs = Math.max(0, Math.min(clip.durationMs, timeMs));
  let lo = 0, hi = clip.frames.length - 1;
  while (lo + 1 < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (clip.frames[middle].tMs <= tMs) lo = middle;
    else hi = middle;
  }
  const a = clip.frames[lo], b = clip.frames[hi];
  if (tMs === a.tMs) return { ...a };
  if (tMs === b.tMs) return { ...b };
  const ratio = (tMs - a.tMs) / (b.tMs - a.tMs);
  function joint(name: Joint): Pose | null {
    const start = a[name], end = b[name];
    if (!start || !end) return null;
    return {
      position: [
        start.position[0] + (end.position[0] - start.position[0]) * ratio,
        start.position[1] + (end.position[1] - start.position[1]) * ratio,
        start.position[2] + (end.position[2] - start.position[2]) * ratio,
      ],
      orientation: interpolateOrientation(start.orientation, end.orientation, ratio),
    };
  }
  return { tMs, head: joint('head'), leftHand: joint('leftHand'), rightHand: joint('rightHand') };
}

export type Transport = { phase: 'idle' | 'playing' | 'paused' | 'ended'; offsetMs: number; anchorS: number };
export const INITIAL_TRANSPORT: Transport = { phase: 'idle', offsetMs: 0, anchorS: 0 };
export function transportTime(transport: Transport, contextS: number, durationMs: number): number {
  if (!Number.isFinite(contextS)) throw new Error('声音时钟无效。');
  const delta = transport.phase === 'playing' ? Math.max(0, contextS - transport.anchorS) * 1000 : 0;
  return Math.min(durationMs, transport.offsetMs + delta);
}
export function startTransport(transport: Transport, anchorS: number, durationMs: number): Transport {
  return { phase: 'playing', offsetMs: transport.offsetMs >= durationMs ? 0 : transport.offsetMs, anchorS };
}
export function pauseTransport(transport: Transport, contextS: number, durationMs: number): Transport {
  const offsetMs = transportTime(transport, contextS, durationMs);
  return { phase: offsetMs >= durationMs ? 'ended' : 'paused', offsetMs, anchorS: contextS };
}

// Match the media check's scheduling guard. This is an interruption detector,
// not a motion/audio synchronization acceptance threshold.
export const MAX_REPLAY_FRAME_GAP_MS = 250;

/** Resume at the last observed frame instead of silently skipping a rendering stall. */
export function pauseStalledTransport(transport: Transport, previousMs: number, currentMs: number, durationMs: number): Transport | null {
  if (![previousMs, currentMs, durationMs].every(Number.isFinite)
    || previousMs < 0 || currentMs < previousMs || durationMs <= 0 || previousMs > durationMs) {
    throw new Error('回放画面时钟无效。');
  }
  if (transport.phase !== 'playing' || currentMs - previousMs <= MAX_REPLAY_FRAME_GAP_MS) return null;
  return { ...transport, phase: 'paused', offsetMs: previousMs };
}
