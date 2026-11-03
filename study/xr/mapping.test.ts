import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Object3D, Vector3 } from 'three';
import { createMappingDriver, mappingScale } from './mapping';
import { REFERENCE_MAPPING } from '../core/demo';
test('direct target mapping respects parent transforms, scale and missing validity', () => {
  const root = new Group(); root.position.set(3, 0, 2); root.rotation.y = Math.PI / 2;
  const parent = new Group(); parent.position.set(0, .5, 0); root.add(parent);
  for (const name of ['head', 'leftHand', 'rightHand']) { const node = new Object3D(); node.name = name; parent.add(node); }
  const d = createMappingDriver(root, REFERENCE_MAPPING), pose = { position: [0, 1, 0] as const, orientation: [0, 0, 0, 1] as const };
  const flags = d.apply({ head: pose, leftHand: null, rightHand: pose }, 1.5); root.updateMatrixWorld(true);
  assert.equal(flags.leftHand, false); assert.equal(root.getObjectByName('leftHand')!.visible, false);
  assert.ok(root.getObjectByName('head')!.getWorldPosition(new Vector3()).distanceTo(new Vector3(3, 1.5, 2)) < 1e-10);
  d.reset(); assert.equal(root.getObjectByName('leftHand')!.visible, true);
  assert.throws(() => d.apply({ head: pose, leftHand: null, rightHand: pose }, 0)); assert.throws(() => createMappingDriver(new Group(), REFERENCE_MAPPING));
  assert.equal(mappingScale(1.7, 1.7), 1); assert.throws(() => mappingScale(1.7, 0)); assert.throws(() => mappingScale(1.7, .01));
});
