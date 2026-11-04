import { Bone, Euler, Quaternion, Vector3, type Object3D } from 'three';
import type { Joint, Pose } from '../core/motion';
import type { Mapping } from '../core/materials';
import { solveArm } from '../core/arm-ik';
import { createMappingDriver } from './mapping';

export function hasHumanRig(root: Object3D) { let found=false;root.traverse(n=>{if(n.userData.humanRig===3)found=true;});return found; }
/** Three tracked points cannot recover a body. Preserve measurements in proxies;
 * solve the visible anatomy separately with fixed limb lengths and grip-to-wrist calibration.
 * Finger curls are the authored neutral pose, never represented as captured motion.
 */
export function createHumanDriver(root: Object3D, mapping: Mapping) {
  const tracked=createMappingDriver(root,mapping), saved:{node:Bone;p:Vector3;q:Quaternion}[]=[];
  root.traverse(n=>{if(n instanceof Bone)saved.push({node:n,p:n.position.clone(),q:n.quaternion.clone()});});
  const bone=(name:string)=>{const n=root.getObjectByName(name);if(!n)throw Error(`人体骨架缺少 ${name}`);return n;};
  root.updateMatrixWorld(true);
  const skull=bone('Skull'),skullOffset=root.worldToLocal(skull.getWorldPosition(new Vector3())).sub(new Vector3(0,mapping.heightMetres,0));
  const skullRest=root.getWorldQuaternion(new Quaternion()).invert().multiply(skull.getWorldQuaternion(new Quaternion()));
  const arms=(['Left','Right'] as const).map((side,index)=>({side,sign:index===0?-1:1,joint:index===0?'leftHand' as const:'rightHand' as const,upper:bone(side+'UpperArm'),lower:bone(side+'LowerArm'),wrist:bone(side+'Wrist')}));
  function reset(){for(const s of saved){s.node.position.copy(s.p);s.node.quaternion.copy(s.q);}tracked.reset();root.updateMatrixWorld(true);}
  function worldRotation(node:Object3D,q:Quaternion){node.quaternion.copy(node.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);}
  function apply(poses:Record<Joint,Pose|null>,scale:number){
    reset();const validity=tracked.apply(poses,scale),rootQ=root.getWorldQuaternion(new Quaternion());
    if(poses.head){
      const spine=bone('Spine'),head=bone(mapping.nodes.head),desired=head.getWorldPosition(new Vector3()),natural=root.localToWorld(new Vector3(0,mapping.heightMetres,0));
      const lean=root.worldToLocal(desired.clone()).sub(root.worldToLocal(natural.clone()));
      const delta=new Quaternion().setFromEuler(new Euler(Math.max(-.18,Math.min(.18,lean.z*.6)),0,Math.max(-.18,Math.min(.18,-lean.x*.6))));
      spine.quaternion.multiply(delta);root.updateMatrixWorld(true);
      const q=new Quaternion(...poses.head.orientation),position=desired.add(skullOffset.clone().applyQuaternion(q).applyQuaternion(rootQ));
      skull.position.copy(skull.parent!.worldToLocal(position));worldRotation(skull,rootQ.clone().multiply(q).multiply(skullRest));
    }
    for(const a of arms){
      const pose=poses[a.joint];if(!pose)continue;
      const grip=bone(mapping.nodes[a.joint]),q=rootQ.clone().multiply(new Quaternion(...pose.orientation));
      // WebXR +Y points toward the arm; 75mm is this asset's palm-centre/wrist offset.
      const target=grip.getWorldPosition(new Vector3()).add(new Vector3(0,.075,0).applyQuaternion(q));
      const shoulder=a.upper.getWorldPosition(new Vector3()),elbow=a.lower.getWorldPosition(new Vector3()),wrist=a.wrist.getWorldPosition(new Vector3());
      const upperDirection=elbow.clone().sub(shoulder),lowerDirection=wrist.clone().sub(elbow),upperQ=a.upper.getWorldQuaternion(new Quaternion()),lowerQ=a.lower.getWorldQuaternion(new Quaternion());
      // A relaxed outward/downward elbow plane. No translated wrists or stretched forearms.
      const pole=root.localToWorld(root.worldToLocal(shoulder.clone()).add(new Vector3(a.sign*.22,-.45,.12)));
      const solved=solveArm(shoulder.toArray(),target.toArray(),pole.toArray(),upperDirection.length(),lowerDirection.length());
      worldRotation(a.upper,new Quaternion().setFromUnitVectors(upperDirection.normalize(),new Vector3(...solved.elbow).sub(shoulder).normalize()).multiply(upperQ));
      worldRotation(a.lower,new Quaternion().setFromUnitVectors(lowerDirection.normalize(),new Vector3(...solved.wrist).sub(new Vector3(...solved.elbow)).normalize()).multiply(lowerQ));
      worldRotation(a.wrist,q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-a.sign*Math.PI/2)));
    }
    for(const [joint,surface] of [['head','HeadSurface'],['leftHand','LeftHandSurface'],['rightHand','RightHandSurface']] as const){const mesh=root.getObjectByName(surface);if(mesh)mesh.visible=validity[joint];}
    return validity;
  }
  return {apply,reset,tracked};
}
