import { Box3, Object3D, Raycaster, SkinnedMesh, Vector3 } from 'three';
import { ROOM, theatreSeats } from '../core/theatre';
import type { Vec3 } from '../core/motion';

// Engineering geometry tolerances and protected routes; not building-code certification.
const EPSILON = .005;
export const CLEAR_ROUTES = [
  { name: '左侧通道', min: [-4.1, 0, -2.6], max: [-3.1, 1.9, 4.4] },
  { name: '右侧通道', min: [3.1, 0, -2.5], max: [4.1, 1.9, 4.4] },
  { name: '后方横向通道', min: [-4.1, 0, 4.04], max: [4.1, 1.9, 4.4] },
  { name: '观众门前', min: [-4.8, 0, 4.4], max: [-3.75, 2.2, 5.04] },
] as const;
export type LayoutAudit = { issues: string[]; furnitureCount: number; pairsChecked: number; supportsChecked: number };
function penetrates(a: Box3, b: Box3) {
  return (['x','y','z'] as const).every(axis => Math.min(a.max[axis], b.max[axis])-Math.max(a.min[axis],b.min[axis]) > EPSILON);
}
/** Inspect the actual unbatched model, including all furniture pairs and supporting surfaces. */
export function auditScenery(root: Object3D): LayoutAudit {
  root.updateMatrixWorld(true);
  const issues: string[] = [];
  const box = (name:string) => {
    const node = root.getObjectByName(name);
    if (!node) { issues.push(`缺少物品：${name}`); return new Box3(); }
    return new Box3().setFromObject(node);
  };
  const furniture = [...theatreSeats().map(s=>s.name), ...[1,2,3,4].map(i=>`Table_${i}`), 'PropShelf', 'TechnicianConsole'];
  const bounds = furniture.map(name=>({name,box:box(name)}));
  let pairsChecked = 0, supportsChecked = 0;
  for(let i=0;i<bounds.length;i++) {
    const a=bounds[i];
    if(Math.abs(a.box.min.y)>EPSILON)issues.push(`未落地：${a.name}`);
    if(a.box.min.x < -ROOM.width/2 || a.box.max.x>ROOM.width/2 || a.box.min.z< -ROOM.depth/2 || a.box.max.z>ROOM.depth/2)issues.push(`超出房间：${a.name}`);
    for(let k=i+1;k<bounds.length;k++){pairsChecked++;if(penetrates(a.box,bounds[k].box))issues.push(`家具相交：${a.name} / ${bounds[k].name}`);}
    for(const route of CLEAR_ROUTES)if(penetrates(a.box,new Box3(new Vector3(...route.min),new Vector3(...route.max))))issues.push(`占用${route.name}：${a.name}`);
  }
  function supported(item:string,support:string) {
    supportsChecked++;
    const a=box(item),b=box(support),centre=a.getCenter(new Vector3());
    if(Math.abs(a.min.y-b.max.y)>.01 || centre.x<b.min.x || centre.x>b.max.x || centre.z<b.min.z || centre.z>b.max.z)issues.push(`支撑不匹配：${item} / ${support}`);
  }
  for(let i=1;i<=4;i++)supported(`TableLamp_${i}`,`Table_${i}`);
  supported('ShelfBooks','Shelf_1');supported('ShelfPlant','Shelf_4');supported('StageMic','Rug');
  supported('StageSpeaker','Stage');supported('StageSpeaker_1','Stage');
  for(const name of ['StageWing','StageStepUpper','StageStepLower'])if(Math.abs(box(name).min.y)>EPSILON)issues.push(`踏步未落地：${name}`);
  const wing=box('StageWing'),door=box('PerformerDoor'),stage=box('Stage');
  if(Math.abs(wing.max.y-stage.max.y)>EPSILON || Math.abs(wing.min.x-stage.max.x)>EPSILON || wing.min.x>door.min.x || wing.max.x<door.max.x || wing.min.z>door.max.z || Math.abs(wing.max.y-door.min.y)>EPSILON)issues.push('演员门与舞台侧翼未连通');
  const upper=box('StageStepUpper'),lower=box('StageStepLower');
  if(Math.abs(upper.min.z-wing.max.z)>EPSILON||Math.abs(lower.min.z-upper.max.z)>EPSILON||Math.abs(wing.max.y-upper.max.y-.12)>EPSILON||Math.abs(upper.max.y-lower.max.y-.12)>EPSILON)issues.push('踏步高度或接缝不连续');
  const decor=['PropShelf','ShelfBooks','ShelfPlant',...[0,1,2,3,4,5].map(i=>`GalleryPrint_${i}`),...[0,1,2].map(i=>`Poster_${i}`)];
  for(const name of decor)for(const side of [-1,1])for(let i=0;i<3;i++)if(penetrates(box(name),box(`Sconce_${side}_${i}`)))issues.push(`装饰与灯具相交：${name}`);
  for(let i=0;i<3;i++)if(penetrates(box(`Poster_${i}`),box(`GalleryPrint_${i}`)))issues.push(`墙画与说明牌相交：${i}`);
  return {issues,furnitureCount:bounds.length,pairsChecked,supportsChecked};
}
/** Sample actual deformed triangles, excluding only the observer's own avatar. */
export function audienceSightlines(audience: Object3D[], seats: ReturnType<typeof theatreSeats>, eyeHeight: number, targets: readonly Vec3[] = [[-.08,2,-3.78],[0,2,-3.78],[.08,2,-3.78]]) {
  for(const root of audience){root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);root.traverse(node=>{if(node instanceof SkinnedMesh){node.skeleton.update();node.computeBoundingSphere();node.computeBoundingBox();}});}
  return seats.flatMap(seat=>targets.flatMap(target=>{
    const eye = new Vector3(...seat.position).add(new Vector3(0,eyeHeight,0)),delta = new Vector3(...target).sub(eye);
    const ray=new Raycaster(eye,delta.clone().normalize(),.1,delta.length()-.15);
    const hit=ray.intersectObjects(audience.filter((_,index)=>index!==seat.id),true)[0];
    return hit ? [{seat:seat.id+1,eyeHeight,target,obstruction:hit.object.name,distance:hit.distance}] : [];
  }));
}
