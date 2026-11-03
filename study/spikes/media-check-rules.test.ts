import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audioPositionMs, chooseVideoCorrection, evaluateMediaCheck } from './media-check-rules.js';

test('audio time is derived from the audio context, not wall-clock time', () => {
  assert.equal(audioPositionMs(12.5, 10), 2500);
  assert.equal(audioPositionMs(9, 10), 0);
  assert.throws(() => audioPositionMs(NaN, 0));
});

test('video slows down when ahead and speeds up when behind audio', () => {
  assert.deepEqual(chooseVideoCorrection(41, 1), { rate: 0.95, seek: false });
  assert.deepEqual(chooseVideoCorrection(-41, 1), { rate: 1.05, seek: false });
  assert.deepEqual(chooseVideoCorrection(40, 1), { rate: 0.95, seek: false });
});

test('correction starts before Quest startup drift exhausts the strict acceptance budget', () => {
  assert.deepEqual(chooseVideoCorrection(20, 1), { rate: 0.95, seek: false });
  assert.deepEqual(chooseVideoCorrection(-20, 1), { rate: 1.05, seek: false });
  assert.equal(chooseVideoCorrection(19.9, 1).rate, 1);
  const result = { elapsedMs: 60010.6667, maxAbsMs: 40.000333, samples: 1800, interrupted: false };
  assert.equal(evaluateMediaCheck(result), 'fail');
});

test('correction keeps hysteresis and seeks only beyond the documented limit', () => {
  assert.equal(chooseVideoCorrection(25, 0.95).rate, 0.95);
  assert.equal(chooseVideoCorrection(10, 0.95).rate, 1);
  assert.equal(chooseVideoCorrection(-10, 1.05).rate, 1);
  assert.equal(chooseVideoCorrection(300, 1).seek, false);
  assert.deepEqual(chooseVideoCorrection(-301, 1.05), { rate: 1, seek: true });
});

test('strict 40 ms maximum and a full uninterrupted minute are required', () => {
  const complete = { elapsedMs: 60000, maxAbsMs: 39.9, samples: 1800, interrupted: false };
  assert.equal(evaluateMediaCheck(complete), 'pass');
  assert.equal(evaluateMediaCheck({ ...complete, maxAbsMs: 40 }), 'fail');
  assert.equal(evaluateMediaCheck({ ...complete, elapsedMs: 59999 }), 'incomplete');
  assert.equal(evaluateMediaCheck({ ...complete, interrupted: true }), 'incomplete');
  assert.equal(evaluateMediaCheck({ ...complete, samples: 0 }), 'incomplete');
  assert.equal(evaluateMediaCheck({ ...complete, maxAbsMs: NaN }), 'incomplete');
});
