import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solveArm } from './arm-ik';
import type { Vec3 } from './motion';
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, i) => v - b[i]));
test('engineering arm estimate preserves bone lengths, uses deterministic bend direction and clamps unreachable targets', () => {
  const root: Vec3 = [1, 2, 3];
  for (const target of [[1.3, 1.7, 3.1], [1, 2, 3], [100, 2, 3], [1, 100, 3]] as Vec3[]) {
    const solved = solveArm(root, target, [1, 1, 3], .3, .25); assert.ok(Math.abs(distance(root, solved.elbow) - .3) < 1e-7); assert.ok(Math.abs(distance(solved.elbow, solved.wrist) - .25) < 1e-7); assert.ok(distance(root, solved.wrist) <= .55);
  }
  const good = solveArm([0, 0, 0], [.3, 0, 0], [0, -1, 0], .3, .3); assert.ok(good.reachable); assert.ok(good.elbow[1] < 0); assert.ok(distance(good.wrist, [.3, 0, 0]) < 1e-7);
  assert.equal(solveArm([0, 0, 0], [100, 0, 0], [1, 0, 0], .3, .3).reachable, false); assert.ok(solveArm([0, 0, 0], [0, 0, 0], [0, -1, 0], .3, .3).elbow.every(Number.isFinite));
  assert.throws(() => solveArm([NaN, 0, 0], [0, 0, 0], [1, 0, 0], .3, .3)); assert.throws(() => solveArm([0, 0, 0], [0, 0, 0], [1, 0, 0], 0, .3));
});
