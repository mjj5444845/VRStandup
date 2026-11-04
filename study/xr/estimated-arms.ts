import { Quaternion, Vector3, type Object3D } from 'three';
import type { Mapping } from '../core/materials';
import type { Joint, Pose } from '../core/motion';
import { solveArm } from '../core/arm-ik';
/** A bounded visual lean connects the neck to lateral head motion; never capture data. */
export function createTorsoEstimate(root: Object3D) {
  const spine = root.getObjectByName('Spine'); if (!spine) throw new Error('躯干骨架缺失。');
  const rest = spine.quaternion.clone();
  function reset() { spine!.quaternion.copy(rest); root.updateMatrixWorld(true); }
  function apply(poses: Record<Joint, Pose | null>, scale: number, mapping: Mapping) {
    if (!poses.head) return;
    const target = root.localToWorld(new Vector3(...poses.head.position).multiplyScalar(scale).add(new Vector3(...mapping.offsets.head)));
    const origin = spine!.getWorldPosition(new Vector3()), direction = target.sub(origin);
    if (direction.length() < .1) return;
    const world = spine!.getWorldQuaternion(new Quaternion()), up = new Vector3(0,1,0).applyQuaternion(world);
    const delta = new Quaternion().setFromUnitVectors(up,direction.normalize()), angle = new Quaternion().angleTo(delta);
    // Twenty degrees is a display deformation bound, not a research or tracking threshold.
    if (angle > .35) delta.slerp(new Quaternion(),1-.35/angle);
    spine!.quaternion.copy(spine!.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(delta).multiply(world));root.updateMatrixWorld(true);
  }
  return { reset, apply };
}
export function createArmEstimate(root: Object3D) {
  const arms = (['Left', 'Right'] as const).map((side, index) => {
    const upper = root.getObjectByName(`${side}UpperArm`), lower = root.getObjectByName(`${side}LowerArm`), hand = root.getObjectByName(`${side}Hand`);
    if (!upper || !lower || !hand) throw new Error('候选手臂骨架缺失。'); return { upper, lower, hand, sign: index === 0 ? -1 : 1, joint: index === 0 ? 'leftHand' as const : 'rightHand' as const, upperRest: upper.quaternion.clone(), lowerRest: lower.quaternion.clone() };
  });
  function reset() { for (const a of arms) { a.upper.quaternion.copy(a.upperRest); a.lower.quaternion.copy(a.lowerRest); } root.updateMatrixWorld(true); }
  function apply(poses: Record<Joint, Pose | null>, scale: number, mapping: Mapping) {
    for (const a of arms) {
      const pose = poses[a.joint]; if (!pose) continue;
      const shoulder = a.upper.getWorldPosition(new Vector3()), elbow = a.lower.getWorldPosition(new Vector3()), wrist = a.hand.getWorldPosition(new Vector3());
      const upperDirection = elbow.clone().sub(shoulder), lowerDirection = wrist.clone().sub(elbow), upperQ = a.upper.getWorldQuaternion(new Quaternion()), lowerQ = a.lower.getWorldQuaternion(new Quaternion());
      const target = root.localToWorld(new Vector3(...pose.position).multiplyScalar(scale).add(new Vector3(...mapping.offsets[a.joint])));
      const pole = root.localToWorld(root.worldToLocal(shoulder.clone()).add(new Vector3(a.sign * .25, -.35, .25)));
      const solved = solveArm(shoulder.toArray(), target.toArray(), pole.toArray(), upperDirection.length(), lowerDirection.length()), bend = new Vector3(...solved.elbow), end = new Vector3(...solved.wrist);
      const worldUpper = new Quaternion().setFromUnitVectors(upperDirection.normalize(), bend.clone().sub(shoulder).normalize()).multiply(upperQ);
      a.upper.quaternion.copy(a.upper.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(worldUpper)); root.updateMatrixWorld(true);
      const worldLower = new Quaternion().setFromUnitVectors(lowerDirection.normalize(), end.sub(bend).normalize()).multiply(lowerQ);
      a.lower.quaternion.copy(a.lower.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(worldLower)); root.updateMatrixWorld(true);
    }
  }
  return { apply, reset };
}
