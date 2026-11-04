import fs from 'node:fs/promises';
import {AnimationMixer,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;globalThis.ProgressEvent=class extends Event{};globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const report=[];
for(const id of ['actor','audience-01','audience-02','audience-03','audience-04','audience-05']){
 const b=await fs.readFile(`public/study/club/v1/models/${id}.glb`),m=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),''),mixer=new AnimationMixer(m.scene);
 for(const name of ['standing-idle','seated-idle','laugh','clap']){
 mixer.stopAllAction();const clip=m.animations.find(a=>a.name===name);mixer.clipAction(clip).play();let floor=Infinity,top=-Infinity,penetration=0;
 for(let t=0;t<clip.duration;t+=.5){mixer.setTime(t);m.scene.updateMatrixWorld(true);m.scene.traverse(mesh=>{if(!(mesh instanceof SkinnedMesh)||mesh.parent.name!=='BodySurface')return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,new Vector3());floor=Math.min(floor,p.y);top=Math.max(top,p.y);if(Math.abs(p.x)<.24&&Math.abs(p.z)<.22&&p.y>.435&&p.y<.525)penetration=Math.max(penetration,.525-p.y);}});}
 report.push({id,name,floor,top,penetration});}
}
console.log(JSON.stringify(report,null,2));
