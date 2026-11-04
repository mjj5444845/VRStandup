import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Modify node transforms only: retain the approved chair geometry and embedded textures.
const original='local_assets/collections/soft-clay-club/v1/models/scene-empty.glb';
const target='public/study/club/v1';
const b=await fs.readFile(original),jsonLength=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jsonLength));
const changes=[];
const shift=(name,position)=>{const n=j.nodes.find(n=>n.name===name);if(!n)throw new Error(name);changes.push({name,before:n.translation,after:position});n.translation=position;};
// Front side seats need lateral clearance from a 0.92m table and 0.50m chair.
for(let table=1;table<=4;table++)for(let chair=1;chair<=3;chair++) {
  const x=table%2===1?-1.55:1.55,z=table<=2?-1.25:.48;
  shift(`Table_${table}_Chair_${chair}`,[Number((x+(chair===1?-.79:chair===3?.79:0)).toFixed(3)),0,Number((z+(chair===2?.84:.17)).toFixed(3))]);
}
shift('StageMic',[1.0,.36,-3.5]);
// The old posters occupied the same wall patch as the wall lights.
[-1.4,1.4,3.8].forEach((z,i)=>shift(`Poster_${i}`,[-5.10,1.25,z]));
shift('ShelfBooks',[4.46,.5175,-.46]);shift('ShelfPlant',[4.46,1.8075,-.46]);
j.asset.extras={...(j.asset.extras??{}),layoutRevision:'clearance-v2',basis:'Physical mesh bounds; wider side chair/table clearance; separate posters/lights; stage microphone outside neutral arm envelope.'};
const text=Buffer.from(JSON.stringify(j)), padded=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(padded);
const tail=b.subarray(20+jsonLength),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
await fs.writeFile(target+'/models/scene-empty.glb',Buffer.concat([header,padded,tail]));
const layout=JSON.parse(await fs.readFile(target+'/scene-layout.json','utf8'));
layout.seats.forEach(s=>{const changed=changes.find(c=>c.name===s.id);if(changed)s.position=changed.after;});layout.revision='clearance-v2';layout.source='Original 24-seat / four-table baseline; front chairs moved outward 0.18m following mesh collision review. Research seat allocation remains pending.';
await fs.writeFile(target+'/scene-layout.json',JSON.stringify(layout,null,2)+'\n');
const manifest=JSON.parse(await fs.readFile(target+'/manifest.json','utf8'));
for(const e of manifest.files){const bytes=await fs.readFile(target+'/'+e.file);e.bytes=bytes.length;e.sha256=createHash('sha256').update(bytes).digest('hex');}
await fs.writeFile(target+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');await fs.writeFile('output/art-review/layout-changes.json',JSON.stringify(changes,null,2));console.log('Adjusted',changes.length,'placements');
