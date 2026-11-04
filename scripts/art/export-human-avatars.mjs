import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHash } from 'node:crypto';
import { solveArm } from '../../study/core/arm-ik.ts';
const source='local_assets/models/human-v3', target='public/study/club/v1';
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}};
const bank=JSON.parse(await fs.readFile(source+'/male-ch06.json','utf8'));
const names={Head:'Skull',LeftHand:'LeftWrist',RightHand:'RightWrist',LeftArm:'LeftUpperArm',RightArm:'RightUpperArm',LeftForeArm:'LeftLowerArm',RightForeArm:'RightLowerArm',Spine2:'Chest',LeftUpLeg:'LeftUpperLeg',RightUpLeg:'RightUpperLeg',LeftLeg:'LeftLowerLeg',RightLeg:'RightLowerLeg'};
const rename=n=>names[n]??n;
const styles=[['actor','male-ch23'],['audience-01','female-ch07'],['audience-02','male-ch31'],['audience-03','female-ch21'],['audience-04','male-ch23'],['audience-05','female-ch02']];
for(const [id,file] of styles.filter(([id])=>!process.argv.includes('--actor-only')||id==='actor')){
  const data=JSON.parse(await fs.readFile(`${source}/${file}.json`,'utf8')),root=new T.Group();root.name='HumanRig';root.userData={humanRig:3,source:data.source,trackingConvention:'WebXR grip: palm centre, +Y toward arm; wrist offset 75mm; no captured fingers'};
  const bones=data.bones.map(b=>{const n=new T.Bone();n.name=rename(b.name);return n;}),byName=new Map(data.bones.map((b,i)=>[b.name,bones[i]]));
  data.bones.forEach((b,i)=>{const p=b.parent?data.bones.find(x=>x.name===b.parent).position:[0,0,0];bones[i].position.fromArray(b.position).sub(new T.Vector3(...p));(b.parent?byName.get(b.parent):root).add(bones[i]);});
  for(const name of ['Head','LeftHand','RightHand']){const n=new T.Object3D();n.name=name;root.add(n);}
  root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
  const materials=data.materials.map((m,i)=>{const mat=new T.MeshStandardMaterial({color:new T.Color().fromArray(m.color),roughness:.87,metalness:0,side:T.DoubleSide});mat.name=`HumanMaterial_${i}`;if(/Eyelash/.test(m.name)){mat.transparent=true;mat.alphaTest=.45;}return mat;});
  const regions={BodySurface:[],HeadSurface:[],LeftHandSurface:[],RightHandSurface:[]};
  for(const part of data.parts){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(part.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));
    const si=[],sw=[];part.weights.forEach(ws=>{const sum=ws.reduce((a,w)=>a+w[1],0)||1;for(let i=0;i<4;i++){si.push(ws[i]?data.bones.findIndex(b=>b.name===ws[i][0]):0);sw.push(ws[i]?ws[i][1]/sum:0);}});
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
    const tris=Object.fromEntries(Object.keys(regions).map(n=>[n,[]]));
    for(let i=0;i<part.index.length;i+=3){const indices=part.index.slice(i,i+3),score={HeadSurface:0,LeftHandSurface:0,RightHandSurface:0};for(const v of indices)for(const [bone,w] of part.weights[v]){if(bone==='Head'||bone==='HeadTop_End')score.HeadSurface+=w;if(bone.startsWith('LeftHand'))score.LeftHandSurface+=w;if(bone.startsWith('RightHand'))score.RightHandSurface+=w;}const winner=Object.keys(score).find(k=>score[k]>1.5)??'BodySurface';tris[winner].push(...indices);}
    for(const [region,index] of Object.entries(tris)){if(!index.length)continue;const unique=[...new Set(index)],remap=new Map(unique.map((v,i)=>[v,i])),sub=new T.BufferGeometry();for(const [name,a]of Object.entries(g.attributes)){const array=new a.array.constructor(unique.length*a.itemSize);unique.forEach((v,i)=>{for(let k=0;k<a.itemSize;k++)array[i*a.itemSize+k]=a.array[v*a.itemSize+k];});sub.setAttribute(name,new T.BufferAttribute(array,a.itemSize));}sub.setIndex(index.map(v=>remap.get(v)));regions[region].push({g:sub,material:part.material});}
  }
  for(const [name,parts] of Object.entries(regions)){
    const g=mergeGeometries(parts.map(p=>p.g),true);g.groups.forEach((group,i)=>{group.materialIndex=parts[i].material;});const mesh=new T.SkinnedMesh(g,materials);mesh.name=name;root.add(mesh);root.updateMatrixWorld(true);mesh.bind(skeleton);mesh.frustumCulled=false;
  }
  const definitions=[['standing-idle','IDLE_Idle2'],['wave','PERFORM_Waving'],['talk','PERFORM_Talking1'],['explain','PERFORM_Talking2'],['seated-idle','SIT_Sitting_Idle1'],['listen','SIT_Sitting_Idle2'],['laugh','SIT_Sitting_Laughing'],['clap','SIT_Sitting_Clap']];
  const clips=[];
  for(const [name,original] of definitions.filter(([n])=>id==='actor'||['standing-idle','seated-idle','listen','laugh','clap'].includes(n))){
    const native=data.animations.find(a=>a.name===original);let a=native??bank.animations.find(a=>a.name===original);if(!a)throw Error(original);
    if(['seated-idle','listen','laugh','clap'].includes(name)){
      const planted=data.animations.find(a=>a.name==='SIT_Sitting_Idle1').frames[0];
      // The source laugh tucks feet under a different chair. Keep a planted seat base;
      // preserve expressive spine, arms, head and independent finger movement.
      a={...a,frames:a.frames.map(f=>Object.fromEntries(Object.entries(f).map(([bone,value])=>[bone,bone==='Hips'||/^(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(bone)?planted[bone]:value])))};
    }
    const times=a.frames.map((_,i)=>i*a.duration/(a.frames.length-1)),tracks=[];
    for(const b of data.bones){const values=[];let previous=null;
      for(const f of a.frames){const q=new T.Quaternion(...f[b.name].q);if(b.parent)q.premultiply(new T.Quaternion(...f[b.parent].q).invert());if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());previous=q;}
      tracks.push(new T.QuaternionKeyframeTrack(rename(b.name)+'.quaternion',times,values));
    }
    const hips=data.bones.find(b=>b.name==='Hips').position,sourceHips=(native?data:bank).bones.find(b=>b.name==='Hips').position;
    const seated=['seated-idle','listen','laugh','clap'].includes(name);
    const hp=a.frames.flatMap(f=>f.Hips.p.map((v,i)=>hips[i]+v-sourceHips[i]-(seated&&i===2?.12:0)));tracks.push(new T.VectorKeyframeTrack('Hips.position',times,hp));
    clips.push(new T.AnimationClip(name,a.duration,tracks));
  }
  // Refit source sitting performances to this project's 525mm cushion and floor.
  // Retain the expressive upper-body/finger animation, bake length-preserving leg IK.
  const fitMixer=new T.AnimationMixer(root),body=root.getObjectByName('BodySurface'),allPositions=body.geometry.attributes.position;
  function sampleMin(mode){skeleton.update();let min=Infinity;for(let i=0;i<allPositions.count;i++){const p=body.getVertexPosition(i,new T.Vector3());if(mode==='floor'||allPositions.getY(i)>.78&&Math.abs(p.x)<.245&&p.z>-.225&&p.z<.225&&p.y>.38)min=Math.min(min,p.y);}return min;}
  function rotate(node,q){node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);}
  for(const clip of clips.filter(c=>['seated-idle','listen','laugh','clap'].includes(c.name))){
    fitMixer.stopAllAction();fitMixer.clipAction(clip).play();const times=clip.tracks[0].times,baked=new Map();
    for(const time of times){fitMixer.setTime(time);root.updateMatrixWorld(true);
      const feet=['Left','Right'].map(side=>{const f=byName.get(side+'Foot');return {side,target:f.getWorldPosition(new T.Vector3()),q:f.getWorldQuaternion(new T.Quaternion())};});
      const floor=sampleMin('floor');feet.forEach(f=>{f.target.y+=.004-floor;f.target.z=Math.min(f.target.z,-.50);});
      for(let pass=0;pass<8;pass++){
        const lift=Math.max(0,.524-sampleMin('seat'));byName.get('Hips').position.y+=Math.min(.15,lift);root.updateMatrixWorld(true);
        for(const f of feet){const upper=byName.get(f.side+'UpLeg'),lower=byName.get(f.side+'Leg'),foot=byName.get(f.side+'Foot');const hip=upper.getWorldPosition(new T.Vector3()),knee=lower.getWorldPosition(new T.Vector3()),ankle=foot.getWorldPosition(new T.Vector3()),u=knee.clone().sub(hip),l=ankle.clone().sub(knee),uq=upper.getWorldQuaternion(new T.Quaternion()),lq=lower.getWorldQuaternion(new T.Quaternion()),pole=hip.clone().add(new T.Vector3(0,-.1,-1));
          const solved=solveArm(hip.toArray(),f.target.toArray(),pole.toArray(),u.length(),l.length());rotate(upper,new T.Quaternion().setFromUnitVectors(u.normalize(),new T.Vector3(...solved.elbow).sub(hip).normalize()).multiply(uq));rotate(lower,new T.Quaternion().setFromUnitVectors(l.normalize(),new T.Vector3(...solved.wrist).sub(new T.Vector3(...solved.elbow)).normalize()).multiply(lq));rotate(foot,f.q);
        }
      }
      for(const name of ['Hips','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot']){const b=byName.get(name),key=rename(name)+(name==='Hips'?'.position':'.quaternion'),values=baked.get(key)??[];values.push(...(name==='Hips'?b.position.toArray():b.quaternion.toArray()));baked.set(key,values);}
    }
    for(const [name,values] of baked){clip.tracks=clip.tracks.filter(t=>t.name!==name);clip.tracks.push(name.endsWith('.position')?new T.VectorKeyframeTrack(name,times,values):new T.QuaternionKeyframeTrack(name,times,values));}
  }
  fitMixer.stopAllAction();fitMixer.uncacheRoot(root);
  // Embed a comfortable rest stance while keeping the bind matrices in anatomical T pose.
  const mixer=new T.AnimationMixer(root);mixer.clipAction(clips[0]).play();mixer.setTime(0);root.updateMatrixWorld(true);
  const binary=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false}));
  const n=binary.readUInt32LE(12),j=JSON.parse(binary.toString('utf8',20,20+n)),bin=binary.subarray(28+n);const chunks=[bin];let offset=bin.length;
  j.images=[];j.textures=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
  for(const mat of j.materials){const i=Number(mat.name.split('_').at(-1)),entry=data.materials[i];if(!entry.image)continue;const bytes=await fs.readFile(source+'/'+(id==='actor'?'hi-':'')+entry.image),pad=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(pad);
    const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=pad.length;chunks.push(pad);const image=j.images.length;j.images.push({bufferView:view,mimeType:'image/png'});j.textures.push({source:image,sampler:0});mat.pbrMetallicRoughness.baseColorTexture={index:j.textures.length-1};}
  j.buffers[0].byteLength=offset;const js=Buffer.from(JSON.stringify(j)),padded=Buffer.alloc(Math.ceil(js.length/4)*4,0x20);js.copy(padded);const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+padded.length+offset,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(offset);bh.writeUInt32LE(0x004e4942,4);
  await fs.writeFile(`${target}/models/${id}.glb`,Buffer.concat([head,padded,bh,...chunks]));console.log('EXPORTED',id,file,offset,clips.map(a=>a.name));
}
const manifest=JSON.parse(await fs.readFile(target+'/manifest.json','utf8'));manifest.sculptRevision='anatomical-v3-2026-11-04';for(const e of manifest.files){const b=await fs.readFile(target+'/'+e.file);e.bytes=b.length;e.sha256=createHash('sha256').update(b).digest('hex');}await fs.writeFile(target+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
