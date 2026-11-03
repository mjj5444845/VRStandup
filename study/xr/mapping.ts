import { Object3D, Quaternion, Vector3 } from 'three';
import { JOINTS, type Joint, type Pose } from '../core/motion';
import { validateMapping, type Mapping } from '../core/materials';
export function mappingScale(targetHeadHeight: number, recordedHeadHeight: number) { const scale = targetHeadHeight / recordedHeadHeight; if (!Number.isFinite(scale) || scale <= 0 || scale > 10) throw new Error('模型参考高度与录制头高比例异常，请核对校准与模型尺寸。'); return scale; }
export function createMappingDriver(root: Object3D, input: Mapping) {
  const mapping = validateMapping(input), nodes = {} as Record<Joint, Object3D>, rest = {} as Record<Joint, { position: Vector3; quaternion: Quaternion; visible: boolean }>;
  for (const joint of JOINTS) { const found: Object3D[] = []; root.traverse(node => { if (node.name === mapping.nodes[joint]) found.push(node); }); if (found.length !== 1) throw new Error(`模型节点 ${mapping.nodes[joint]} 缺失或重名。`); nodes[joint] = found[0]; rest[joint] = { position: found[0].position.clone(), quaternion: found[0].quaternion.clone(), visible: found[0].visible }; }
  if (JOINTS.some(j => nodes[j] === root)) throw new Error('头手目标不能使用演员根节点。');
  function apply(poses: Record<Joint, Pose | null>, scale: number) {
    if (!Number.isFinite(scale) || scale <= 0 || scale > 10) throw new Error('模型比例无效。');
    const validity = {} as Record<Joint, boolean>; root.updateMatrixWorld(true);
    for (const joint of JOINTS) {
      const p = poses[joint], node = nodes[joint]; validity[joint] = Boolean(p); node.visible = Boolean(p);
      if (!p) { node.position.copy(rest[joint].position); node.quaternion.copy(rest[joint].quaternion); continue; }
      const position = new Vector3(...p.position).multiplyScalar(scale).add(new Vector3(...mapping.offsets[joint])); root.localToWorld(position);
      const orientation = root.getWorldQuaternion(new Quaternion()).multiply(new Quaternion(...p.orientation));
      if (node.parent) { node.parent.worldToLocal(position); orientation.premultiply(node.parent.getWorldQuaternion(new Quaternion()).invert()); }
      node.position.copy(position); node.quaternion.copy(orientation); root.updateMatrixWorld(true);
    }
    // Bone visibility alone does not hide a skinned hand; callers must use these validity flags.
    return validity;
  }
  function reset() { for (const joint of JOINTS) { nodes[joint].position.copy(rest[joint].position); nodes[joint].quaternion.copy(rest[joint].quaternion); nodes[joint].visible = rest[joint].visible; } }
  return { apply, reset, mapping };
}
