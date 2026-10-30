import { validateReplayClip, type Pose, type PoseFrame, type ReplayClip } from './replay-rules';

export function createReplayFixture(): ReplayClip {
  const frames: PoseFrame[] = [];
  const durationMs = 12_000;
  // A 100 ms fixture cadence makes interpolation visible; it is not a capture rate requirement.
  for (let tMs = 0; tMs <= durationMs; tMs += 100) {
    const t = tMs / 1000;
    const yaw = Math.sin(t * Math.PI / 3) * 0.3;
    const hand = (x: number, y: number, z: number): Pose => ({ position: [x, y, z], orientation: [0, 0, 0, 1] });
    frames.push({
      tMs,
      head: { position: [Math.sin(t * Math.PI / 3) * 0.12, 1.65, 0], orientation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] },
      leftHand: tMs >= 6000 && tMs <= 6400 ? null : hand(-0.42, 1.12 + Math.sin(t * Math.PI / 2) * 0.18, -0.2),
      rightHand: hand(0.42, 1.12 + (1 - Math.cos(t * Math.PI)) * 0.24, -0.2),
    });
  }
  // Serialize then validate, just as a stored frame sequence would be read.
  return validateReplayClip(JSON.parse(JSON.stringify({ version: 1, source: 'synthetic', id: 'synthetic-head-hands-v1', durationMs, coordinates: 'right-handed-y-up', frames, markersMs: [1000, 3000, 5000, 7000, 9000, 11000] })));
}

/** Generate original beep samples, aligned to the clip's six motion markers. */
export function createReplayAudio(sampleRate: number, clip: ReplayClip): Float32Array {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('声音采样率无效。');
  const samples = new Float32Array(Math.ceil(sampleRate * clip.durationMs / 1000));
  const length = Math.round(sampleRate * 0.08);
  for (const marker of clip.markersMs) {
    const start = Math.round(marker * sampleRate / 1000);
    for (let n = 0; n < length && start + n < samples.length; n++) {
      const envelope = Math.sin(Math.PI * n / length) ** 2;
      samples[start + n] = Math.sin(2 * Math.PI * 660 * n / sampleRate) * envelope * 0.22;
    }
  }
  return samples;
}
