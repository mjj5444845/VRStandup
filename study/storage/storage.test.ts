import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syntheticTake } from '../core/synthetic-take';
import { demoPlan } from '../core/demo';
import { listBundles, readBundle, readTake, saveBundle } from './assets';
import { child, privateRoot } from './private-files';
test('immutable private bundles roundtrip, separate WAV and reject corruption or path escape', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'punchcap-assets-'));
  try {
    const plan = demoPlan(), { id, actorId, kind, model, cues, approval, sync } = plan.clips[1], meta = { id, actorId, kind, model, cues, approval, sync }, take = syntheticTake();
    const manifest = await saveBundle(dir, take, meta), loaded = await readBundle(dir, id);
    assert.equal(loaded.take.audio.frames, take.audio.frames); assert.equal(manifest.source, 'synthetic'); assert.equal(loaded.motion.includes('wavBase64'), false);
    await assert.rejects(saveBundle(dir, take, meta), /已存在/); await assert.rejects(child(dir, '../escape'));
    await assert.rejects(privateRoot(path.resolve('public', 'private-test')), /公开/);
    await assert.rejects(privateRoot(path.resolve('study', 'private-test')), /源码/);
    const old = { ...take, schema: 'punchcap-recording-check-v1' }; assert.equal(readTake(old).schema, 'punchcap-take-v1');
    assert.throws(() => readTake({ ...old, durationMs: 16000 }));
    await fs.appendFile(path.join(dir, id, 'audio.wav'), 'broken'); await assert.rejects(readBundle(dir, id), /校验/); assert.equal((await listBundles(dir))[0].valid, false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
