import type { Pose, Vec3 } from './motion';
import { assert, finite, tuple } from './validation';
export const ROOM = { width: 10.4, depth: 10.4, height: 3.6, stageWidth: 6.4, stageDepth: 2.28, stageHeight: .36, stageZ: -3.78 } as const;
export const ACTOR_ORIGIN: Vec3 = [0, ROOM.stageHeight, ROOM.stageZ];
/** New-design seat centres, converted once from (x,y,z) to (x,z,-y). */
export function theatreSeats() {
  const front = [-1.25, .48].flatMap((z, row) => [-1.55, 1.55].flatMap((x, col) =>
    [[-.61, .17], [0, .66], [.61, .17]].map(([dx, dz], i) => ({ name: `Table_${row * 2 + col + 1}_Chair_${i + 1}`, table: row * 2 + col, position: [Number((x + dx).toFixed(3)), 0, Number((z + dz).toFixed(3))] as Vec3 }))));
  const back = [2.56, 3.62].flatMap((z, row) => [-2.23, -1.338, -.446, .446, 1.338, 2.23].map((x, col) => ({ name: `Rear_R${row + 1}_C${col + 1}`, table: -1, position: [x, 0, z] as Vec3 })));
  return [...front, ...back].map((seat, id) => ({ ...seat, id }));
}
export function onStage(p: Vec3) { return Math.abs(p[0]) <= ROOM.stageWidth / 2 && Math.abs(p[2] - ROOM.stageZ) <= ROOM.stageDepth / 2; }
export function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function distance(a: Vec3, b: Vec3) { return Math.hypot(...a.map((v, i) => v - b[i])); }
export function actorPoint(local: Vec3): Vec3 { return add([-local[0], local[1], -local[2]], ACTOR_ORIGIN); }
export function gazeAngle(head: Pose | null, actor: Vec3 | null): number | null {
  if (!head || !actor) return null;
  const [x, y, z, w] = head.orientation, forward = [-2 * (x * z + w * y), -2 * (y * z - w * x), -(1 - 2 * (x * x + y * y))];
  const delta = actor.map((v, i) => v - head.position[i]), norm = Math.hypot(...delta) * Math.hypot(...forward);
  return norm < 1e-9 ? null : Math.acos(Math.max(-1, Math.min(1, delta.reduce((n, v, i) => n + v * forward[i], 0) / norm))) * 180 / Math.PI;
}
// Engineering interaction limits keep substitute objects controllable; these are not research thresholds.
export const INTERACTION_LIMITS = { minScale: .5, maxScale: 2.5, maxSpeed: 12, gravity: 9.81 } as const;
export function stretchScale(initial: number, startDistance: number, currentDistance: number) {
  assert([initial, startDistance, currentDistance].every(finite) && initial > 0 && startDistance > .001 && currentDistance >= 0, '双手距离或比例无效。');
  return Math.max(INTERACTION_LIMITS.minScale, Math.min(INTERACTION_LIMITS.maxScale, initial * currentDistance / startDistance));
}
export function releaseVelocity(previous: Vec3, current: Vec3, elapsedMs: number): Vec3 {
  assert(tuple(previous, 3) && tuple(current, 3) && finite(elapsedMs) && elapsedMs > 0, '投掷采样无效。');
  const velocity = current.map((v, i) => (v - previous[i]) / elapsedMs * 1000), speed = Math.hypot(...velocity), scale = Math.min(1, INTERACTION_LIMITS.maxSpeed / Math.max(speed, 1e-9));
  return velocity.map(v => v * scale) as unknown as Vec3;
}
export type Flight = { position: Vec3; velocity: Vec3; landed: 'stage' | 'floor' | 'outside' | null };
export function advanceFlight(start: Flight, seconds: number): Flight {
  assert(finite(seconds) && seconds >= 0 && seconds <= .25 && tuple(start.position, 3) && tuple(start.velocity, 3), '飞行步长或坐标无效。');
  if (start.landed) return start;
  const g = INTERACTION_LIMITS.gravity, p = start.position, v = start.velocity;
  const at = (t: number): Vec3 => [p[0] + v[0] * t, p[1] + v[1] * t - g * t * t / 2, p[2] + v[2] * t];
  const crossing = (height: number) => (v[1] + Math.sqrt(Math.max(0, v[1] ** 2 + 2 * g * (p[1] - height)))) / g;
  const ts = crossing(ROOM.stageHeight), tf = crossing(0);
  let t = seconds, landed: Flight['landed'] = null;
  if (p[1] >= ROOM.stageHeight && ts <= seconds && onStage(at(ts))) { t = ts; landed = 'stage'; }
  else if (tf <= seconds) { t = tf; landed = 'floor'; }
  let position = at(t); if (landed === 'stage' || landed === 'floor') position = [position[0], landed === 'stage' ? ROOM.stageHeight : 0, position[2]];
  if (Math.abs(position[0]) > ROOM.width / 2 || Math.abs(position[2]) > ROOM.depth / 2) landed = 'outside';
  return { position, velocity: [v[0], v[1] - g * t, v[2]], landed };
}
