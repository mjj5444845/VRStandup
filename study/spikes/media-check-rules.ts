// Source: docs/design/reference/VIDEO_PANEL_GUIDE.md, M0 S3/video-follow. Keep these exact
// study limits distinct from engineering timeouts used to load test media.
export const MEDIA_LIMITS = {
  durationMs: 60_000,
  driftLimitMs: 40,
  recoverMs: 10,
  seekMs: 300,
} as const;
export type FollowRate = 0.95 | 1 | 1.05;
export type MediaVerdict = 'pass' | 'fail' | 'incomplete';

// Begin correcting at half the acceptance budget so the next video frame has
// headroom. This controls playback; it does not change the strict 40 ms verdict.
export const VIDEO_CORRECTION_START_MS = MEDIA_LIMITS.driftLimitMs / 2;

export function audioPositionMs(contextTimeS: number, startedAtS: number) {
  if (!Number.isFinite(contextTimeS) || !Number.isFinite(startedAtS)) throw new Error('Invalid audio clock');
  return Math.max(0, (contextTimeS - startedAtS) * 1000);
}

export function chooseVideoCorrection(driftMs: number, previousRate: FollowRate): { rate: FollowRate; seek: boolean } {
  if (!Number.isFinite(driftMs)) throw new Error('Invalid video drift');
  if (Math.abs(driftMs) > MEDIA_LIMITS.seekMs) return { rate: 1, seek: true };
  if (driftMs >= VIDEO_CORRECTION_START_MS) return { rate: 0.95, seek: false };
  if (driftMs <= -VIDEO_CORRECTION_START_MS) return { rate: 1.05, seek: false };
  if (Math.abs(driftMs) <= MEDIA_LIMITS.recoverMs) return { rate: 1, seek: false };
  return { rate: previousRate, seek: false };
}

export function evaluateMediaCheck(result: { elapsedMs: number; maxAbsMs: number; samples: number; interrupted: boolean }): MediaVerdict {
  if (result.interrupted || result.samples === 0 || !Number.isFinite(result.maxAbsMs)
    || !Number.isFinite(result.elapsedMs) || result.elapsedMs < MEDIA_LIMITS.durationMs) return 'incomplete';
  return result.maxAbsMs < MEDIA_LIMITS.driftLimitMs ? 'pass' : 'fail';
}
