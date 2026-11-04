import { assert, finite } from './validation';
/** Desktop inspection angles only; this never changes an immersive headset pose. */
export function desktopView(yaw: number, pitch: number, dx: number, dy: number) {
  assert([yaw, pitch, dx, dy].every(finite), '查看角度无效。');
  const next = yaw - dx * .004;
  return { yaw: Math.atan2(Math.sin(next), Math.cos(next)), pitch: Math.max(-1.2, Math.min(1.2, pitch - dy * .004)) };
}
