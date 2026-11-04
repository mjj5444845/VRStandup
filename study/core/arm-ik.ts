import type { Vec3 } from './motion';
import { assert, finite, tuple } from './validation';
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a.reduce((n, v, i) => n + v * b[i], 0);
const size = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => a.map(v => v / size(a)) as unknown as Vec3;
/** Engineering two-bone estimate; elbow and out-of-reach wrist are never recorded as captured poses. */
export function solveArm(root: Vec3, target: Vec3, pole: Vec3, upper: number, lower: number) {
  assert([root, target, pole].every(p => tuple(p, 3)) && [upper, lower].every(n => finite(n) && n > .001 && n < 10), '手臂估算输入无效。');
  const delta = sub(target, root), distance = size(delta), direction: Vec3 = distance > 1e-8 ? unit(delta) : [0, -1, 0];
  const reach = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(upper + lower - 1e-6, distance));
  let plane = sub(pole, root); plane = plane.map((v, i) => v - direction[i] * dot(plane, direction)) as unknown as Vec3;
  if (size(plane) < 1e-8) { const axis: Vec3 = Math.abs(direction[0]) < .8 ? [1, 0, 0] : [0, 1, 0]; plane = axis.map((v, i) => v - direction[i] * dot(axis, direction)) as unknown as Vec3; }
  const sideways = unit(plane), along = (upper * upper - lower * lower + reach * reach) / (2 * reach), height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { elbow: root.map((v, i) => v + direction[i] * along + sideways[i] * height) as unknown as Vec3, wrist: root.map((v, i) => v + direction[i] * reach) as unknown as Vec3, reachable: distance <= upper + lower && distance >= Math.abs(upper - lower) };
}
