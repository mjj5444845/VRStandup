import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { base64Bytes, calibratedPose, makeCalibration, pcmWave, sampleRecording, validateRecording, waveBytes, type RecordedTake } from './recording-rules';

function fixture(): RecordedTake {
  const pose = { position: [0, 1.6, 0] as const, orientation: [0, 0, 0, 1] as const, emulatedPosition: false };
  return {
    schema: 'punchcap-recording-check-v1', source: 'test-fixture', id: 'test-take', createdAt: '2026-11-03T00:00:00Z', browser: 'unit-test',
    referenceSpace: 'local-floor', coordinates: 'right-handed-y-up-metres', durationMs: 200,
    calibration: { origin: [0, 0, 0], yaw: 0, headHeight: 1.6 }, interrupted: false, stopReason: 'user', events: [],
    devices: [{ id: 'left-1', handedness: 'left', kind: 'controller', profiles: ['generic-trigger'] }],
    frames: [0, 100, 200].map(tMs => ({ tMs, predictedDisplayTimeMs: 5000 + tMs, observedPerformanceTimeMs: 4990 + tMs,
      head: { ...pose, position: [tMs / 1000, 1.6, 0] }, leftHand: pose, rightHand: null, leftSource: 'left-1', rightSource: null })),
    audio: { clock: 'audio-context-pcm-frames', sampleRate: 8000, frames: 1600, startContextFrame: 8000,
      wavBase64: base64Bytes(pcmWave(new Float32Array(1600), 8000)), baseLatencySeconds: null,
      processing: { echoCancellation: null, noiseSuppression: false, autoGainControl: false } },
  };
}
test('a recorded local file roundtrips with exact PCM sample count and explicit source', () => {
  const take = validateRecording(JSON.parse(JSON.stringify(fixture())));
  assert.equal(waveBytes(take).length, 3244);
  assert.equal(take.audio.frames / take.audio.sampleRate * 1000, take.durationMs);
  const estimated = fixture(); estimated.frames[1].head!.emulatedPosition = true;
  assert.equal(validateRecording(estimated).frames[1].head!.emulatedPosition, true);
});
test('untrusted recordings reject invented tracking, duplicate time and swapped device identity', () => {
  const wrongSource = { ...fixture(), schema: 'synthetic' }; assert.throws(() => validateRecording(wrongSource));
  const duplicates = fixture(); duplicates.frames[1].tMs = 0; assert.throws(() => validateRecording(duplicates));
  const device = fixture(); device.devices[0].handedness = 'right'; assert.throws(() => validateRecording(device));
  const invalid = fixture(); invalid.frames[0].head!.orientation = [0, 0, 0, 0]; assert.throws(() => validateRecording(invalid));
  const nan = fixture(); nan.frames[0].head!.position = [0, NaN, 0]; assert.throws(() => validateRecording(nan));
});
test('truncated PCM, forged sample rate and false duration cannot pass import', () => {
  const truncated = fixture(); truncated.audio.wavBase64 = base64Bytes(waveBytes(truncated).slice(0, -2)); assert.throws(() => validateRecording(truncated));
  const duration = fixture(); duration.durationMs = 300; assert.throws(() => validateRecording(duration));
  const rate = fixture(); const bytes = waveBytes(rate); bytes[24] = 1; rate.audio.wavBase64 = base64Bytes(bytes); assert.throws(() => validateRecording(rate));
});
test('retained prefixes, absent frame coverage and unfinished limits cannot claim a clean take', () => {
  const prefix = fixture(); prefix.events.push({ tMs: 200, type: 'buffered-prefix', detail: 'audio-finalize-timeout' });
  assert.throws(() => validateRecording(prefix)); prefix.interrupted = true;
  assert.equal(validateRecording(prefix).durationMs, 200);
  const limit = fixture(); limit.stopReason = 'limit'; assert.throws(() => validateRecording(limit));
  const gap = fixture(); gap.durationMs = 500; gap.audio.frames = 4000;
  gap.audio.wavBase64 = base64Bytes(pcmWave(new Float32Array(4000), 8000));
  assert.throws(() => validateRecording(gap)); gap.interrupted = true;
  assert.equal(validateRecording(gap).durationMs, 500);
});
test('calibration maps the actor origin and yaw while preserving measured floor height', () => {
  const head = { position: [10, 1.7, 20] as const, orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const };
  const calibration = makeCalibration(head);
  assert.deepEqual(calibration.origin, [10, 0, 20]); assert.equal(calibration.headHeight, 1.7);
  const normalized = calibratedPose({ ...head, position: [9, 1.2, 20] }, calibration);
  assert.ok(Math.abs(normalized.position[0]) < 1e-12); assert.ok(Math.abs(normalized.position[2] + 1) < 1e-12);
  assert.equal(normalized.position[1], 1.2); assert.ok(Math.abs(normalized.orientation[3] - 1) < 1e-12);
  assert.throws(() => makeCalibration({ ...head, orientation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] }));
});
test('recorded replay hides absent coverage, missing tracking and source changes', () => {
  const take = fixture();
  assert.ok(Math.abs(sampleRecording(take, 50).head!.position[0] - 0.05) < 1e-9);
  assert.equal(sampleRecording(take, -1).head, null); assert.equal(sampleRecording(take, 201).head, null);
  take.frames[1].leftHand = null; assert.equal(sampleRecording(take, 50).leftHand, null);
  take.frames[1].leftHand = take.frames[0].leftHand; take.frames[1].leftSource = 'left-2';
  assert.equal(sampleRecording(take, 50).leftHand, null);
  take.frames[1].tMs = 500; take.frames[2].tMs = 600; assert.equal(sampleRecording(take, 250).head, null);
});
test('PCM conversion clips overflow and rejects nonfinite samples', () => {
  const bytes = pcmWave(new Float32Array([-2, -1, 0, 1, 2]), 48000); const view = new DataView(bytes.buffer);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => view.getInt16(44 + i * 2, true)), [-32768, -32768, 0, 32767, 32767]);
  assert.throws(() => pcmWave(new Float32Array([NaN]), 48000));
});

type Processor = { port: { onmessage: (event: { data: unknown }) => void }; process: (inputs: Float32Array[][]) => boolean };
async function worklet() {
  const messages: { type: string; startFrame: number; samples?: Float32Array; frames?: number; reason?: string }[] = [];
  let Constructor: (new () => Processor) | undefined;
  const scope = { currentFrame: 0, sampleRate: 8000, Float32Array,
    AudioWorkletProcessor: class { port = { onmessage: () => {}, postMessage: (message: typeof messages[number]) => messages.push(message) }; },
    registerProcessor: (_name: string, processor: new () => Processor) => { Constructor = processor; } };
  vm.runInNewContext(await readFile(new URL('../../public/study/checks/recording/pcm-capture.js', import.meta.url), 'utf8'), scope);
  assert.ok(Constructor); return { scope, processor: new Constructor(), messages };
}
test('actual worklet honours sample-accurate scheduled start and flushes a partial stop chunk', async () => {
  const { scope, processor, messages } = await worklet();
  processor.port.onmessage({ data: { type: 'start', startFrame: 80, maxFrames: 800 } });
  processor.process([[new Float32Array(128).fill(0.25)]]);
  scope.currentFrame = 128; processor.process([[new Float32Array(128).fill(0.5)]]);
  processor.port.onmessage({ data: { type: 'stop' } });
  assert.equal(messages[0].startFrame, 80); assert.equal(messages[0].samples!.length, 176);
  assert.equal(messages[0].samples![0], 0.25); assert.equal(messages[0].samples![48], 0.5);
  assert.equal(messages[1].frames, 176); assert.equal(messages[1].reason, 'user');
});
test('worklet reports clock gaps and enforces its automatic capture limit', async () => {
  const first = await worklet(); first.processor.port.onmessage({ data: { type: 'start', startFrame: 0, maxFrames: 256 } });
  first.processor.process([[new Float32Array(128)]]); first.scope.currentFrame = 256; first.processor.process([[new Float32Array(128)]]);
  assert.equal(first.messages.at(-1)?.reason, 'clock-gap'); assert.equal(first.messages.at(-1)?.frames, 128);
  const second = await worklet(); second.processor.port.onmessage({ data: { type: 'start', startFrame: 0, maxFrames: 80 } });
  second.processor.process([[new Float32Array(128)]]); assert.equal(second.messages.at(-1)?.reason, 'limit'); assert.equal(second.messages.at(-1)?.frames, 80);
});
