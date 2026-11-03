import { base64Bytes, pcmWave, validateRecording, type CapturedPose } from './recording';
/** Original engineering motion and clicks, never actor evidence or approved content. */
export function syntheticTake(id = 'synthetic-take') {
  const rate = 48000, seconds = 12, samples = new Float32Array(rate * seconds);
  for (let i = 0; i < samples.length; i++) { const phase = i / rate % 2; if (phase < .05) samples[i] = .1 * Math.sin(i / rate * 440 * 2 * Math.PI) * (1 - phase / .05); }
  const pose = (x: number, y: number, z: number): CapturedPose => ({ position: [x, y, z], orientation: [0, 0, 0, 1], emulatedPosition: false });
  return validateRecording({ schema: 'punchcap-take-v1', id, source: 'test-fixture', createdAt: '2026-11-03T00:00:00Z', browser: 'engineering-generator-v1', referenceSpace: 'local-floor', coordinates: 'right-handed-y-up-metres', calibration: { origin: [0, 0, 0], yaw: 0, headHeight: 1.7 }, durationMs: seconds * 1000, captureLimitMs: 180000,
    devices: [{ id: 'left', handedness: 'left', kind: 'controller', profiles: ['synthetic'] }, { id: 'right', handedness: 'right', kind: 'controller', profiles: ['synthetic'] }],
    frames: Array.from({ length: 1201 }, (_, i) => ({ tMs: i * 10, predictedDisplayTimeMs: i * 10, observedPerformanceTimeMs: i * 10, head: pose(0, 1.7 + .02 * Math.sin(i / 30), 0), leftHand: pose(-.35, 1.1 + .2 * Math.sin(i / 50), -.2), rightHand: pose(.35, 1.1 + .2 * Math.cos(i / 50), -.2), leftSource: 'left', rightSource: 'right' })),
    interrupted: false, stopReason: 'user', events: [], audio: { clock: 'audio-context-pcm-frames', sampleRate: rate, frames: samples.length, startContextFrame: 0, wavBase64: base64Bytes(pcmWave(samples, rate)), baseLatencySeconds: null, processing: { echoCancellation: null, noiseSuppression: null, autoGainControl: null } } });
}
