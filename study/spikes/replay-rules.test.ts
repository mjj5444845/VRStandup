import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReplayAudio, createReplayFixture } from './replay-fixture';
import { INITIAL_TRANSPORT, interpolateOrientation, pauseStalledTransport, pauseTransport, sampleReplay, startTransport, transportTime, validateReplayClip } from './replay-rules';

test('stored synthetic frames survive validation; malformed tracking and times are rejected', () => {
  const clip = createReplayFixture();
  assert.equal(clip.frames.length, 121);
  assert.throws(() => validateReplayClip({ ...clip, frames: [clip.frames[0], clip.frames[0], ...clip.frames.slice(1)] }));
  assert.throws(() => validateReplayClip({ ...clip, frames: [{ ...clip.frames[0], head: { position: [0, NaN, 0], orientation: [0, 0, 0, 1] } }, ...clip.frames.slice(1)] }));
  assert.throws(() => validateReplayClip({ ...clip, frames: [{ ...clip.frames[0], head: { position: [0, 1, 0], orientation: [0, 0, 0, 0] } }, ...clip.frames.slice(1)] }));
  assert.throws(() => validateReplayClip({ ...clip, markersMs: [3000, 1000] }));
});
test('position interpolation clamps endpoints and preserves missing tracking', () => {
  const clip = createReplayFixture();
  const expected = (clip.frames[0].head!.position[0] + clip.frames[1].head!.position[0]) / 2;
  assert.equal(sampleReplay(clip, 50).head!.position[0], expected);
  assert.equal(sampleReplay(clip, -100).tMs, 0);
  assert.equal(sampleReplay(clip, 14000).tMs, 12000);
  assert.equal(sampleReplay(clip, 5950).leftHand, null);
  assert.equal(sampleReplay(clip, 6200).leftHand, null);
  assert.equal(sampleReplay(clip, 6450).leftHand, null);
  assert.ok(sampleReplay(clip, 6500).leftHand);
  assert.throws(() => sampleReplay(clip, NaN));
});
test('quaternion interpolation takes the short arc and retains unit length', () => {
  const identical = interpolateOrientation([0, 0, 0, 1], [0, 0, 0, -1], 0.5);
  assert.deepEqual(identical, [0, 0, 0, 1]);
  const half = interpolateOrientation([0, 0, 0, 1], [0, 1, 0, 0], 0.5);
  assert.ok(Math.abs(half[1] - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...half) - 1) < 1e-9);
});
test('pause freezes the audio-derived position; resume, future starts, and replay do not jump', () => {
  const running = startTransport(INITIAL_TRANSPORT, 10.05, 12000);
  assert.equal(transportTime(running, 10, 12000), 0);
  const paused = pauseTransport(running, 12.05, 12000);
  assert.equal(transportTime(paused, 100, 12000), 2000);
  const resumed = startTransport(paused, 100.05, 12000);
  assert.equal(transportTime(resumed, 101.05, 12000), 3000);
  const ended = pauseTransport(resumed, 200, 12000);
  assert.equal(ended.phase, 'ended');
  assert.equal(startTransport(ended, 201, 12000).offsetMs, 0);
});
test('beep regions and right-hand peaks share the same six timestamps', () => {
  const clip = createReplayFixture(), rate = 48000;
  const audio = createReplayAudio(rate, clip);
  assert.equal(audio.length, 12 * rate);
  for (const marker of clip.markersMs) {
    assert.ok(Math.abs(sampleReplay(clip, marker).rightHand!.position[1] - 1.6) < 1e-9);
    const start = Math.round(marker * rate / 1000);
    assert.ok(audio.slice(start, start + rate * 0.08).some((n) => Math.abs(n) > 0.1));
    assert.ok(audio.slice(start - 0.1 * rate, start).every((n) => n === 0));
  }
  assert.throws(() => createReplayAudio(0, clip));
});

test('a background rendering stall pauses at the last observed frame and resumes without skipping markers', () => {
  const running = startTransport(INITIAL_TRANSPORT, 10, 12000);
  const paused = pauseStalledTransport(running, 1990, 3000, 12000);
  assert.ok(paused);
  assert.equal(paused.phase, 'paused');
  assert.equal(transportTime(paused, 100, 12000), 1990);
  const resumed = startTransport(paused, 100, 12000);
  assert.ok(Math.abs(transportTime(resumed, 100.02, 12000) - 2010) < 1e-8);
  assert.equal(pauseStalledTransport(running, 1990, 2240, 12000), null);
  assert.equal(pauseStalledTransport(paused, 1990, 4000, 12000), null);
});

test('a stall beyond the clip end cannot masquerade as a completed replay', () => {
  const running = startTransport(INITIAL_TRANSPORT, 10, 12000);
  const paused = pauseStalledTransport(running, 11900, 15000, 12000);
  assert.equal(paused?.phase, 'paused');
  assert.equal(paused?.offsetMs, 11900);
  assert.throws(() => pauseStalledTransport(running, 1000, 999, 12000));
  assert.throws(() => pauseStalledTransport(running, 1000, NaN, 12000));
});
