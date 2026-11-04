import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { theatreSeats } from '../../study/core/theatre.ts';
import { CLUB_LIGHTING } from '../../study/core/club-lighting.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=path.join(root,'public/study/club/v1'),work=path.join(root,'local_assets/models/scene-polish-v4');
await fs.mkdir(work,{recursive:true});
const target=path.join(base,'models/scene-empty.glb'),baseline=path.join(work,'scene-before-polish.glb');
function decode(b){const n=b.readUInt32LE(12);return {j:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n)};}
try {await fs.access(baseline);}catch {const b=await fs.readFile(target);if(decode(b).j.asset.extras?.layoutRevision==='scene-polish-v4')throw Error('Missing preserved pre-polish baseline');await fs.writeFile(baseline,b,{flag:'wx'});}
const {j,bin}=decode(await fs.readFile(baseline)), detail=decode(await fs.readFile(path.join(work,'stage-details.glb')));
const changes=[];
function shift(name,position){const node=j.nodes.find(n=>n.name===name);if(!node)throw Error(name);changes.push({name,before:node.translation,after:position});node.translation=position;}
for(const seat of theatreSeats())shift(seat.name,seat.position);
shift('StageMic',[1.15,.368,-3.65]);
// Recompose the little typography cards as captions below each framed print.
for(let i=0;i<3;i++){const n=j.nodes.find(n=>n.name===`Poster_${i}`);n.translation[1]=1.06;n.scale=[.40,.40,.40];}
const colours={PBR_floor:[.63,.69,.77,1],PBR_wall:[.92,.94,.97,1],PBR_panel:[.8,.92,1,1],SoftClay_wood:[.32,.19,.105,1],SoftClay_clay:[.25,.092,.054,1],SoftClay_sage:[.105,.17,.135,1],'Gallery warm oak':[.19,.105,.06,1]};
for(const m of j.materials){if(colours[m.name])m.pbrMetallicRoughness.baseColorFactor=colours[m.name];}
// Append the independently authored Blender details without re-encoding existing meshes or textures.
const no=j.nodes.length,mo=j.meshes.length,ao=j.accessors.length,vo=j.bufferViews.length,ma=j.materials.length;
if(detail.j.images?.length||detail.j.skins?.length||detail.j.animations?.length)throw Error('Details must be static untextured geometry');
j.bufferViews.push(...detail.j.bufferViews.map(v=>({...v,buffer:0,byteOffset:(v.byteOffset??0)+bin.length})));
j.accessors.push(...detail.j.accessors.map(a=>({...a,bufferView:a.bufferView+vo})));
j.materials.push(...detail.j.materials);
j.meshes.push(...detail.j.meshes.map(m=>({...m,primitives:m.primitives.map(p=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,v+ao])),indices:p.indices+ao,material:p.material+ma}))})));
j.nodes.push(...detail.j.nodes.map(n=>({...n,...(n.mesh===undefined?{}:{mesh:n.mesh+mo}),...(n.children?{children:n.children.map(c=>c+no)}:{})})));
j.scenes[j.scene??0].nodes.push(...detail.j.scenes[detail.j.scene??0].nodes.map(n=>n+no));
j.asset.extras={...j.asset.extras,layoutRevision:'scene-polish-v4',basis:'Blender bevelled stage access; measured seating and prop clearances; original embedded imagery retained'};
j.buffers[0].byteLength=bin.length+detail.bin.length;
const data=Buffer.from(JSON.stringify(j)),json=Buffer.alloc(Math.ceil(data.length/4)*4,32);data.copy(json);
const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+j.buffers[0].byteLength,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(j.buffers[0].byteLength);bh.writeUInt32LE(0x004e4942,4);
await fs.writeFile(target,Buffer.concat([h,json,bh,bin,detail.bin]));
const layout=JSON.parse(await fs.readFile(path.join(base,'scene-layout.json'),'utf8'));
for(const s of layout.seats)s.position=theatreSeats().find(n=>n.name===s.id).position;
layout.revision='scene-polish-v4';layout.source='Four tables / 24 seats retained; measured sightline staggering. See docs/design/SCENE_POLISH_PLAN.md. Formal allocation remains pending.';
await fs.writeFile(path.join(base,'scene-layout.json'),JSON.stringify(layout,null,2)+'\n');
await fs.writeFile(path.join(base,'lighting.json'),JSON.stringify(CLUB_LIGHTING,null,2)+'\n');
const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
for(const e of manifest.files){const b=await fs.readFile(path.join(base,e.file));e.bytes=b.length;e.sha256=createHash('sha256').update(b).digest('hex');}
await fs.writeFile(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(work,'changes.json'),JSON.stringify(changes,null,2)+'\n');
console.log('Polished runtime scene; original baseline retained:',baseline);
