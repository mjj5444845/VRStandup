import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAssetLibrary } from './asset-library';
import { engineeringPlan } from './engineering';
test('asset library responses validate manifests and never trust a valid flag alone', () => {
  const manifest = engineeringPlan().clips[0];
  const entry = { id: manifest.id, valid: true, manifest };
  assert.equal(validateAssetLibrary([entry])[0].manifest?.id, manifest.id);
  assert.deepEqual(validateAssetLibrary([{id:'broken',valid:false,error:'hash mismatch'}]), [{id:'broken',valid:false,error:'hash mismatch'}]);
  for (const value of [{}, [entry,entry], [{...entry,manifest:{}}], [{...entry,id:'other'}], [{id:'x',valid:false}], [{id:'x',valid:'true'}]]) assert.throws(() => validateAssetLibrary(value));
});
