import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { BoxGeometry, Mesh, MeshBasicMaterial, SpotLight } from 'three';
import { parseClubModel, disposeClub } from './club-loader';
import { buildTheatre } from './theatre-layout';
import { auditScenery, audienceSightlines } from './layout-audit';
import { CLUB_LIGHTING } from '../core/club-lighting';

// Geometry tests do not claim to decode or inspect texture pixels.
Object.defineProperty(globalThis,'self',{configurable:true,value:globalThis});
Object.defineProperty(globalThis,'ProgressEvent',{configurable:true,value:class extends Event{}});
Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async()=>({width:1,height:1,close(){}})});
async function model(id:string){const b=await fs.readFile(`public/study/club/v1/models/${id}.glb`);return parseClubModel(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}

test('all shipped furniture pairs, prop supports, protected routes and stage access remain clear',async()=>{
  const {scene}=await model('scene-empty');
  try {
    const report=auditScenery(scene);
    assert.deepEqual(report.issues,[]);assert.equal(report.furnitureCount,30);assert.equal(report.pairsChecked,435);assert.equal(report.supportsChecked,9);
    const chair=scene.getObjectByName('Table_1_Chair_1')!,before=chair.position.clone();
    chair.position.set(-1.55,0,-1.25);assert.ok(auditScenery(scene).issues.some(s=>s.includes('家具相交')));chair.position.copy(before);
    chair.position.x=-3.5;assert.ok(auditScenery(scene).issues.some(s=>s.includes('左侧通道')));chair.position.copy(before);
    const lamp=scene.getObjectByName('TableLamp_1')!;lamp.position.y+=.1;assert.ok(auditScenery(scene).issues.some(s=>s.includes('支撑不匹配')));lamp.position.y-=.1;
    const wing=scene.getObjectByName('StageWing')!;wing.position.y+=.15;assert.ok(auditScenery(scene).issues.some(s=>s.includes('未连通')));
  } finally {disposeClub([scene]);}
});

test('all 24 seats preserve the sampled actor head sightline across three eye heights and audience reactions',async()=>{
  const room=buildTheatre();
  try {
    await room.load(model);
    const failures=[];
    for(const active of [false,true])for(const time of [0,1000,2500]){
      room.reaction(time,active);
      for(const height of [1.1,1.2,1.3])failures.push(...audienceSightlines(room.audience,room.seats,height).map(hit=>({...hit,active,time})));
    }
    assert.deepEqual(failures,[]);
    // A real mesh in front of a seat must be detected, even when that avatar is hidden for another observer.
    const block=new Mesh(new BoxGeometry(2,3,.2),new MeshBasicMaterial());room.audience[0].add(block);block.position.set(0,1.5,1);
    assert.ok(audienceSightlines(room.audience,room.seats,1.2).length>0);
  } finally {room.dispose();}
});

test('inspection cutaways retain wall hierarchy and lighting manifest matches the shared runtime preset',async()=>{
  const room=buildTheatre();
  try {
    await room.load(model);
    for(const name of ['RoomCeiling','RoomFrontWall','RoomLeftWall','RoomRightWall','RoomBackWall']){
      const node=room.root.getObjectByName(name)!;assert.ok(node);assert.ok(node instanceof Mesh || node.children.length>0,`${name} must retain its visible geometry`);
    }
    assert.deepEqual(JSON.parse(await fs.readFile('public/study/club/v1/lighting.json','utf8')),CLUB_LIGHTING);
    const spots: SpotLight[]=[];room.root.traverse(n=>{if(n instanceof SpotLight)spots.push(n);});assert.equal(spots.length,2);assert.ok(spots.every(s=>!s.castShadow));
  } finally {room.dispose();}
});
