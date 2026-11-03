import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeSync, samplePrepared } from './sync';
import { syntheticTake } from './synthetic-take';
import { demoPlan } from './demo';
test('sync summaries retain all residuals, uncertainty and no invented acceptance threshold', () => {
  const observations = [0, 1, 2, 3].map(i => ({ id: `m${i}`, motionMs: i * 1000, audioMs: i * 1000 + [10, 12, 8, 14][i], uncertaintyMs: 2 }));
  const summary = summarizeSync({ schema: 'punchcap-sync-observations-v1', takeId: 'take', method: 'unit-test annotation', observations });
  assert.equal(summary.offsetMs, 11); assert.equal(summary.uncertaintyMs, 5); assert.equal(summary.researchAccepted, false); assert.equal(summary.residuals.length, 4);
  assert.throws(() => summarizeSync({})); const odd = summarizeSync({ schema: 'punchcap-sync-observations-v1', takeId: 'take', method: 'unit-test', observations: observations.slice(0, 3) }); assert.equal(odd.offsetMs, 10);
  assert.throws(() => summarizeSync({ schema: 'punchcap-sync-observations-v1', takeId: 'take', method: 'unit-test', observations: [observations[0], observations[0], observations[1]] }));
  const take = syntheticTake('main1'), manifest = demoPlan().clips[1]; manifest.takeId = take.id; manifest.sync.offsetMs = 10;
  assert.equal(samplePrepared(take, manifest, 0).head, null); assert.deepEqual(samplePrepared(take, manifest, 10).head?.position, take.frames[0].head?.position);
  assert.throws(() => samplePrepared(take, { ...manifest, takeId: 'other' }, 10));
});
