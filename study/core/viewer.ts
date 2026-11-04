import type { Pose, Vec3 } from './motion';
import { ROOM } from './theatre';
import { assert, tuple } from './validation';
/** Align a new XR reference space once; subsequent head motion remains fully tracked. */
export function fixedSeatRig(head: Pose, seat: Vec3) {
  assert(tuple(head.position, 3) && tuple(head.orientation, 4) && tuple(seat, 3), '座位或头部姿态无效。');
  const [x, y, z, w] = head.orientation, fx = -2 * (x * z + w * y), fz = -(1 - 2 * (x * x + y * y));
  if (Math.hypot(fx, fz) < .1) return null;
  const yaw = Math.atan2(seat[0], seat[2] - ROOM.stageZ) - Math.atan2(-fx, -fz), c = Math.cos(yaw), s = Math.sin(yaw), p = head.position;
  return { yaw, position: [seat[0] - c * p[0] - s * p[2], 0, seat[2] + s * p[0] - c * p[2]] as Vec3 };
}
