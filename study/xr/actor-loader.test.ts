import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadActor } from './actor-loader';
import { REFERENCE_MAPPING } from '../core/demo';
function glb(extra: Record<string, unknown> = {}) {
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1, 2] }], nodes: [{ name: 'head' }, { name: 'leftHand' }, { name: 'rightHand' }], ...extra });
  const encoded = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, ' ')), bytes = new ArrayBuffer(20 + encoded.length), view = new DataView(bytes);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.byteLength, true); view.setUint32(12, encoded.length, true); view.setUint32(16, 0x4e4f534a, true); new Uint8Array(bytes, 20).set(encoded); return bytes;
}
test('self-contained GLB resolves exact mapping nodes and blocks external dependencies before loading', async () => {
  const loaded = await loadActor(glb(), REFERENCE_MAPPING); assert.ok(loaded.scene.getObjectByName('head')); loaded.dispose();
  await assert.rejects(loadActor(glb({ images: [{ uri: 'https://outside.example/private' }] }), REFERENCE_MAPPING), /外部/);
  await assert.rejects(loadActor(glb({ extensionsRequired: ['KHR_draco_mesh_compression'] }), REFERENCE_MAPPING), /扩展/);
  await assert.rejects(loadActor(new ArrayBuffer(10), REFERENCE_MAPPING));
});
