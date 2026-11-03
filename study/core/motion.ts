export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type Pose = { position: Vec3; orientation: Quat };
export const JOINTS = ['head', 'leftHand', 'rightHand'] as const;
export type Joint = typeof JOINTS[number];
export function interpolateOrientation(a: Quat, b: Quat, t: number): Quat {
  const raw = a.reduce((n, value, i) => n + value * b[i], 0), sign = raw < 0 ? -1 : 1, dot = Math.min(1, Math.abs(raw));
  let wa = 1 - t, wb = t;
  if (dot < .9995) { const angle = Math.acos(dot), sine = Math.sin(angle); wa = Math.sin((1 - t) * angle) / sine; wb = Math.sin(t * angle) / sine; }
  const q = a.map((v, i) => v * wa + b[i] * sign * wb), norm = Math.hypot(...q);
  return [q[0] / norm, q[1] / norm, q[2] / norm, q[3] / norm];
}
export type Transport = { phase: 'idle' | 'playing' | 'paused' | 'ended'; offsetMs: number; anchorS: number };
export const INITIAL_TRANSPORT: Transport = { phase: 'idle', offsetMs: 0, anchorS: 0 };
export function transportTime(t: Transport, contextS: number, durationMs: number): number {
  if (![contextS, durationMs, t.offsetMs, t.anchorS].every(Number.isFinite) || durationMs <= 0 || t.offsetMs < 0) throw new Error('播放时钟或时长无效。');
  return Math.min(durationMs, t.offsetMs + (t.phase === 'playing' ? Math.max(0, contextS - t.anchorS) * 1000 : 0));
}
export function startTransport(t: Transport, anchorS: number, durationMs: number): Transport {
  transportTime(t, anchorS, durationMs); return { phase: 'playing', offsetMs: t.offsetMs >= durationMs ? 0 : t.offsetMs, anchorS };
}
export function pauseTransport(t: Transport, contextS: number, durationMs: number): Transport {
  const offsetMs = transportTime(t, contextS, durationMs); return { phase: offsetMs >= durationMs ? 'ended' : 'paused', offsetMs, anchorS: contextS };
}
export const MAX_REPLAY_FRAME_GAP_MS = 250;
export function pauseStalledTransport(t: Transport, previousMs: number, currentMs: number, durationMs: number): Transport | null {
  if (![previousMs, currentMs, durationMs].every(Number.isFinite) || previousMs < 0 || currentMs < previousMs || durationMs <= 0 || previousMs > durationMs) throw new Error('回放画面时钟无效。');
  return t.phase === 'playing' && currentMs - previousMs > MAX_REPLAY_FRAME_GAP_MS ? { ...t, phase: 'paused', offsetMs: previousMs } : null;
}
