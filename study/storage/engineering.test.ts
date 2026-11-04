import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { engineeringPlan } from '../core/engineering';
import { REFERENCE_MAPPING } from '../core/demo';
import { CLUB_MAPPING } from '../core/club-assets';
import { syntheticTake } from '../core/synthetic-take';
import { readBundle, saveBundle } from './assets';
import { prepareEngineering } from './engineering';

test('current human engineering copies coexist with preserved legacy clips and reject mismatched mappings', async () => {
  const temp = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(temp, 'punchcap-model-version-'));
  try {
    const legacy = await saveBundle(root, syntheticTake('club-flow-practice'), { ...engineeringPlan().clips[0], id: 'club-flow-practice', model: REFERENCE_MAPPING });
    const original = await readBundle(root, legacy.id), plan = await prepareEngineering(root);
    assert.deepEqual(await readBundle(root, legacy.id), original);
    assert.equal(plan.clips.length, 6);
    for (const clip of plan.clips) {
      assert.ok(clip.id.includes(CLUB_MAPPING.modelVersion));
      assert.deepEqual(clip.model, CLUB_MAPPING);
      assert.equal((await readBundle(root, clip.id)).manifest.files.audio.sha256, clip.files.audio.sha256);
    }
    assert.deepEqual(await prepareEngineering(root), plan);
    const file = path.join(root, plan.clips[0].id, 'manifest.json'), changed = structuredClone(plan.clips[0]);
    changed.model.modelVersion = 'v1-candidate';
    await fs.writeFile(file, JSON.stringify(changed));
    await assert.rejects(prepareEngineering(root), /已有工程素材与当前定义不符/);
    assert.equal((await readBundle(root, changed.id)).manifest.model.modelVersion, 'v1-candidate');
  } finally {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  }
});
