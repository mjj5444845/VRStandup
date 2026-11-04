import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createArmEstimate } from '../../study/xr/estimated-arms.ts';
import { createMappingDriver } from '../../study/xr/mapping.ts';
import { CLUB_MAPPING } from '../../study/core/club-assets.ts';

const source = 'local_assets/collections/soft-clay-club/v1/models';
const sculpt = JSON.parse(await fs.readFile('local_assets/models/clay-avatar-v2/sculpt-meshes.json', 'utf8'));
const target = 'public/study/club/v1';
// GLTFExporter only needs binary FileReader for these texture-free character meshes.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const styles = [
  ['actor','#c98f70','#302821','#a84e32','#59644a','short'],
  ['audience-01','#d7a17e','#3b2923','#67816f','#4b5550','bob'],
  ['audience-02','#986747','#25211f','#c8bc9d','#596650','short'],
  ['audience-03','#be8769','#4d352c','#af7c6d','#555b60','bun'],
  ['audience-04','#dfb18c','#71513b','#7b855d','#4a5353','short'],
  ['audience-05','#b68669','#302a30','#6a8389','#635848','bob'],
];
const palette = { shirt:'#ede0c4',shoe:'#e1d1ad',sole:'#b7a78c',eye:'#f3e5ce',iris:'#49362b',pupil:'#201d1b',lip:'#925e50',gold:'#bca17b' };
const clamp = v => Math.min(1,Math.max(0,v));
const smooth = v => { v=clamp(v);return v*v*(3-2*v); };
function bindings(tag,x,y) {
  if(tag==='neck'){const head=smooth((y-1.43)/.09);return [['Neck',1-head],['Head',head]];}
  if(tag==='jacket') {
    const side=x<0?'Left':'Right', threshold=.18-.035*smooth((y-1.29)/.08), sleeve=smooth((Math.abs(x)-threshold)/.075);
    if(!sleeve)return bindings('torso',x,y);
    const lower=1-smooth((y-1.08)/.12), wrist=smooth((.99-y)/.08);
    return [['Chest',1-sleeve],[side+'UpperArm',sleeve*(1-lower)],[side+'LowerArm',sleeve*lower*(1-wrist)],[side+'Hand',sleeve*lower*wrist]];
  }
  if(tag==='trousers')return bindings((x<0?'Left':'Right')+'Leg',x,y);
  if (tag === 'torso') { const chest=smooth((y-1.25)/.13), hip=1-smooth((y-1.02)/.12); return [['Hips',hip],['Spine',(1-hip)*(1-chest)],['Chest',(1-hip)*chest]]; }
  if (tag.endsWith('Sleeve')) {
    const side=tag.slice(0,-6), lower=1-smooth((y-1.08)/.12), shoulder=1-smooth((Math.abs(x)-.14)/.10);
    return [['Chest',shoulder], [side+'UpperArm',(1-shoulder)*(1-lower)],[side+'LowerArm',(1-shoulder)*lower]];
  }
  if (tag.endsWith('Leg')) {
    const side=tag.slice(0,-3), upper=smooth((y-.43)/.13), hip=smooth((y-.89)/.10);
    return [[side+'LowerLeg',1-upper],[side+'UpperLeg',upper*(1-hip)],['Hips',upper*hip]];
  }
  return [[tag,1]];
}
const reports=[];
for (const [id,skin,hair,coat,pants,hairstyle] of styles) {
  const bytes=await fs.readFile(path.join(source,id+'.glb'));
  const old=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const root=old.scene; root.updateMatrixWorld(true);
  const oldMeshes=[]; root.traverse(n=>{if(n.isSkinnedMesh)oldMeshes.push(n);});
  const skeleton=oldMeshes[0].skeleton, bones=skeleton.bones.map(b=>b.name);
  oldMeshes.forEach(m=>m.removeFromParent());
  // Replace the old hands-on-hips idle with a relaxed lowered-arm authored loop.
  const arms=createArmEstimate(root),driver=createMappingDriver(root,CLUB_MAPPING),times=Array.from({length:25},(_,i)=>i/6),tracks=new Map();
  for(const t of times) {
    arms.reset();driver.reset();
    const q = sign => new T.Quaternion().setFromUnitVectors(new T.Vector3(sign*.11,-.22,0).normalize(),new T.Vector3(0,-1,0)).toArray();
    const poses={head:{position:[0,1.605,0],orientation:[0,0,0,1]},leftHand:{position:[-.255,.835+.003*Math.sin(t*Math.PI/2),-.015],orientation:q(-1)},rightHand:{position:[.255,.835+.003*Math.sin(t*Math.PI/2),-.015],orientation:q(1)}};
    arms.apply(poses,1,CLUB_MAPPING);driver.apply(poses,1);
    for(const side of ['Left','Right'])for(const part of ['UpperArm','LowerArm','Hand']){const name=side+part,values=tracks.get(name)??[];values.push(...root.getObjectByName(name).quaternion.toArray());tracks.set(name,values);}
  }
  arms.reset();driver.reset();root.updateMatrixWorld(true);
  const idle=old.animations.find(a=>a.name==='standing-idle');idle.tracks=idle.tracks.filter(t=>![...tracks.keys()].some(n=>t.name===n+'.quaternion'));
  for(const [name,values] of tracks)idle.tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,values));
  // Fit the fuller sculpted pelvis to the actual cushion (top 0.525m), keeping feet on the floor.
  for(const clip of old.animations.filter(a=>['seated-idle','listen','laugh','clap'].includes(a.name))) {
    const hip=clip.tracks.find(t=>t.name==='Hips.position');for(let i=1;i<hip.values.length;i+=3){hip.values[i]+=.05;hip.values[i+1]-=.12;}
    const angle=Math.acos((.674-.045-.49)/.435);
    for(const side of ['Left','Right'])for(const [part,a] of [['UpperLeg',angle],['LowerLeg',-angle]]) {
      const track=clip.tracks.find(t=>t.name===side+part+'.quaternion'),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),a).toArray();
      for(let i=0;i<track.values.length;i+=4)track.values.set(q,i);
    }
  }
  // Resting audience hands follow their thighs, instead of hovering palm-up beside the table.
  const boneRest=skeleton.bones.map(b=>({bone:b,p:b.position.clone(),q:b.quaternion.clone()}));
  for(const clip of old.animations.filter(a=>['seated-idle','listen','laugh'].includes(a.name))) {
    const sampler=new T.AnimationClip('sample',clip.duration,clip.tracks.filter(t=>!t.name.includes('morphTarget'))),mixer=new T.AnimationMixer(root),values=new Map();
    mixer.clipAction(sampler).play();
    for(const t of times){mixer.setTime(t);arms.reset();driver.reset();root.updateMatrixWorld(true);
      const handPose=sign=>({position:[sign*.14,.65+.003*Math.sin(t*Math.PI/2),-.37],orientation:new T.Quaternion().setFromUnitVectors(new T.Vector3(sign*.11,-.22,0).normalize(),new T.Vector3(0,-.3,-.954).normalize()).toArray()});
      const poses={head:null,leftHand:handPose(-1),rightHand:handPose(1)};arms.apply(poses,1,CLUB_MAPPING);driver.apply(poses,1);
      for(const side of ['Left','Right'])for(const part of ['UpperArm','LowerArm','Hand']){const name=side+part,v=values.get(name)??[];v.push(...root.getObjectByName(name).quaternion.toArray());values.set(name,v);}
    }
    mixer.stopAllAction();mixer.uncacheRoot(root);clip.tracks=clip.tracks.filter(t=>![...values.keys()].some(n=>t.name===n+'.quaternion'));
    for(const [name,v] of values)clip.tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,v));
    for(const r of boneRest){r.bone.position.copy(r.p);r.bone.quaternion.copy(r.q);}driver.reset();root.updateMatrixWorld(true);
  }
  const colors={...palette,skin,hair,coat,pants};
  for (const region of ['body','head','left','right']) {
    const parts=sculpt.filter(p=>p.region===region&&(p.variant==='all'||p.variant===hairstyle));
    const geometries=parts.map(p=>{
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(p.normal,3));g.setIndex(p.index);
      const n=p.position.length/3, indices=new Uint16Array(n*4),weights=new Float32Array(n*4),colours=new Float32Array(n*3),color=new T.Color(colors[p.palette]);
      for(let i=0;i<n;i++) {
        const influences=bindings(p.bind,p.position[i*3],p.position[i*3+1]);
        influences.forEach(([bone,w],j)=>{if(!bones.includes(bone))throw new Error('Unknown bone '+bone);indices[i*4+j]=bones.indexOf(bone);weights[i*4+j]=w;});
        colours.set([color.r,color.g,color.b],i*3);
      }
      g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));
      if(region==='head') {
        g.morphAttributes.position=['Blink','Smile','MouthOpen'].map((name,mode)=>{
          const a=new T.Float32BufferAttribute(p.position.slice(),3);a.name=name;
          for(let i=0;i<n;i++) {
            const x=a.getX(i), y=a.getY(i);
            if(mode===0&&/Eye |Iris |Pupil |glint|lid/.test(p.name))a.setY(i,1.617+(y-1.617)*.12);
            if(mode===1&&/Smile|lip/.test(p.name))a.setY(i,y+.006*Math.min(1,Math.abs(x)/.025));
            if(mode===2&&/Smile|lip/.test(p.name))a.setY(i,y-.007*(1-Math.min(1,Math.abs(x)/.03)));
          }
          return a;
        });
      }
      return g;
    });
    const geometry=mergeGeometries(geometries,false); if(!geometry)throw new Error('Merge failed');
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,side:T.DoubleSide}); material.name='SculptedClay_VertexColours';
    const mesh=new T.SkinnedMesh(geometry,material);mesh.name={body:'BodySurface',head:'HeadSurface',left:'LeftHandSurface',right:'RightHandSurface'}[region];
    root.add(mesh);root.updateMatrixWorld(true);mesh.bind(skeleton);mesh.normalizeSkinWeights();mesh.castShadow=true;mesh.receiveShadow=true;
    if(region==='head')mesh.morphTargetDictionary={Blink:0,Smile:1,MouthOpen:2};
    geometries.forEach(g=>g.dispose());
  }
  root.userData={...root.userData,sculptRevision:'clay-v2-2026-11-04',authoring:'Blender continuous sculpt/loft; original authored geometry; existing recording skeleton retained'};
  const output=await new GLTFExporter().parseAsync(root,{binary:true,animations:old.animations,onlyVisible:false});
  await fs.writeFile(`${target}/models/${id}.glb`,Buffer.from(output));
  reports.push({id,bytes:output.byteLength,triangles:sculpt.filter(p=>p.variant==='all'||p.variant===hairstyle).reduce((n,p)=>n+p.index.length/3,0),bones:bones.length,animations:old.animations.map(a=>a.name)});
}
const manifest=JSON.parse(await fs.readFile(target+'/manifest.json','utf8'));
manifest.sculptRevision='clay-v2-2026-11-04';
for(const entry of manifest.files){const b=await fs.readFile(path.join(target,entry.file));entry.bytes=b.length;entry.sha256=createHash('sha256').update(b).digest('hex');}
await fs.writeFile(target+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('output/art-review/characters.json',JSON.stringify(reports,null,2));console.log(reports);
