import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { AnimationMixer, Box3, Mesh, Quaternion, Raycaster, SkinnedMesh, Vector3 } from 'three';
import { buildTheatre } from './theatre-layout';
import { parseClubModel } from './club-loader';
import { CLUB_MAPPING, CLUB_CAPTIONS } from '../core/club-assets';
import { actorPoint, PREVIEW_SEAT } from '../core/theatre';
import { mappingScale } from './mapping';
import { sampleRecording } from '../core/recording';
import { syntheticTake } from '../core/synthetic-take';
const base = 'public/study/club/v1/';
test('public runtime assets match hashes, carry no external model dependencies, and include licensed images, font and audio', async () => {
  const manifest = JSON.parse(await fs.readFile(base + 'manifest.json', 'utf8'));
  assert.equal(manifest.files.length, 26);
  for (const entry of manifest.files) {
    assert.ok(!entry.file.includes('..')); const bytes = await fs.readFile(base + entry.file);
    assert.equal(bytes.length, entry.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    if (entry.file.endsWith('.glb')) { const j = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))); assert.equal(j.asset.version, '2.0'); for (const item of [...(j.buffers ?? []), ...(j.images ?? [])]) assert.equal(item.uri, undefined); }
    if (entry.file.endsWith('.wav')) { assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE'); assert.equal(bytes.readUInt32LE(24), 44100); }
    if (entry.file.endsWith('.png')) { assert.equal(bytes.readUInt32BE(0), 0x89504e47); assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0); }
  }
  assert.deepEqual(JSON.parse(await fs.readFile(base + 'rigs/actor-mapping.json', 'utf8')), CLUB_MAPPING);
  assert.ok((await fs.readFile(base + 'fonts/OFL.txt', 'utf8')).includes('SIL OPEN FONT LICENSE'));
  assert.deepEqual(manifest.graphics.map((g: { id: string }) => g.id), CLUB_CAPTIONS.map(g => g.id));
});
test('actual shipped GLBs load into 24-seat theatre, drive tracked surfaces and audience animation, then release shared resources', async () => {
  // Texture decoding is stubbed only in this Node structure test; browser/Quest appearance remains separate.
  const names = ['self', 'ProgressEvent', 'createImageBitmap'] as const, original = names.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, 'ProgressEvent', { configurable: true, value: class extends Event { constructor(type: string) { super(type); } } });
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async (blob: Blob) => { const b = new DataView(await blob.arrayBuffer()); return { width: b.getUint32(16), height: b.getUint32(20), close() {} }; } });
  const room = buildTheatre();
  try {
    await room.load(async id => { const b = await fs.readFile(base + `models/${id}.glb`); return parseClubModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); });
    assert.equal(room.seats.length, 24); assert.equal(room.seats.filter(s => s.table >= 0).length, 12); assert.equal(room.audience.filter(a => a.visible).length, 23); assert.ok(room.savedCalls > 100);
    const layout = JSON.parse(await fs.readFile(base + 'scene-layout.json', 'utf8')); room.seats.forEach((s, i) => { assert.equal(s.name, layout.seats[i].id); assert.deepEqual(s.position, layout.seats[i].position); });
    const take = syntheticTake(), poses = sampleRecording(take, 1000), scale = mappingScale(room.heightMetres, take.calibration.headHeight); room.apply(poses, scale); room.root.updateMatrixWorld(true);
    const expected = actorPoint(poses.head!.position.map(v => v * scale) as unknown as [number, number, number]); assert.ok(room.actor.getObjectByName('Head')!.getWorldPosition(new Vector3()).distanceTo(new Vector3(...expected)) < 1e-6);
    room.configure(CLUB_MAPPING); const upper = room.actor.getObjectByName('LeftUpperArm')!, hand = room.actor.getObjectByName('LeftHand')!, restQ = upper.quaternion.clone(), lowerLength = hand.position.length(), raw = JSON.stringify(poses);
    room.apply(poses, scale, true); assert.ok(upper.quaternion.angleTo(restQ) > .05); assert.ok(Math.abs(hand.position.length() - lowerLength) < 1e-6); assert.equal(JSON.stringify(poses), raw);
    const trackedHand = actorPoint(poses.leftHand!.position.map(v => v * scale) as unknown as [number, number, number]); assert.ok(room.point('leftHand').distanceTo(new Vector3(...trackedHand)) < 1e-6);
    room.apply({ ...poses, leftHand: null }, scale, true); assert.equal(room.actor.getObjectByName('LeftHandSurface')!.visible, false); room.apply(poses, scale, false); assert.ok(upper.quaternion.angleTo(restQ) < 1e-6);
    room.configure({ ...CLUB_MAPPING, offsets: { ...CLUB_MAPPING.offsets, head: [.1, .2, .3] } }); room.apply(poses, scale);
    assert.ok(room.point('head').distanceTo(new Vector3(expected[0] - .1, expected[1] + .2, expected[2] - .3)) < 1e-6);
    assert.throws(() => room.configure({ ...CLUB_MAPPING, modelVersion: 'wrong-model' })); room.configure(CLUB_MAPPING); room.apply(poses, scale);
    room.apply({ ...poses, leftHand: null }, scale); assert.equal(room.actor.getObjectByName('LeftHandSurface')!.visible, false); assert.equal(room.actor.getObjectByName('RightHandSurface')!.visible, true);
    room.apply({ ...poses, head: null }, scale); assert.equal(room.actor.visible, false); room.apply(poses, scale);
    room.reaction(1000, false); const hip = room.audience[0].getObjectByName('Hips')!, first = hip.position.clone(); room.reaction(1800, true); assert.ok(hip.position.distanceTo(first) > .0001);
    room.reaction(1000, false); room.root.updateMatrixWorld(true); room.root.traverse(n => { if (n instanceof SkinnedMesh) { n.skeleton.update(); n.computeBoundingSphere(); n.computeBoundingBox(); } });
    const eye = new Vector3(...room.seats[PREVIEW_SEAT].position).add(new Vector3(0, 1.2, 0)), target = new Vector3(...expected), direction = target.clone().sub(eye);
    const sight = new Raycaster(eye, direction.clone().normalize(), .1, direction.length() - .2); assert.equal(sight.intersectObjects(room.audience.filter(a => a.visible), true).length, 0, 'preview actor head must not be blocked by audience');
    room.view(0); assert.equal(room.audience[0].visible, false); assert.equal(room.audience[20].visible, true); assert.throws(() => room.view(24));
    const geometry = new Set<import('three').BufferGeometry>(), materials = new Set<import('three').Material>(); room.root.traverse(n => { if (n instanceof Mesh) { geometry.add(n.geometry); (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => materials.add(m)); } });
    let released = 0; geometry.forEach(g => g.addEventListener('dispose', () => released++)); materials.forEach(m => m.addEventListener('dispose', () => released++)); room.dispose(); assert.equal(released, geometry.size + materials.size); room.dispose(); assert.equal(room.root.children.length, 0);
  } finally { room.dispose(); names.forEach((n, i) => { const d = original[i]; if (d) Object.defineProperty(globalThis, n, d); else Reflect.deleteProperty(globalThis, n); }); }
});

test('actual furniture bounds have table/chair clearance and posters do not occupy wall lights', async () => {
  const names = ['self', 'ProgressEvent', 'createImageBitmap'] as const, original = names.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  Object.defineProperty(globalThis,'self',{configurable:true,value:globalThis});
  Object.defineProperty(globalThis,'ProgressEvent',{configurable:true,value:class extends Event{}});
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async()=>({width:1,height:1,close(){}})});
  try {
    const b=await fs.readFile(base+'models/scene-empty.glb'), model=await parseClubModel(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
    const bounds=(name:string)=>{const n=model.scene.getObjectByName(name);assert.ok(n,name);return new Box3().setFromObject(n);};
    for(let table=1;table<=4;table++)for(let chair=1;chair<=3;chair++)assert.equal(bounds(`Table_${table}`).intersectsBox(bounds(`Table_${table}_Chair_${chair}`)),false,'furniture must not overlap');
    for(let p=0;p<3;p++)for(let l=0;l<3;l++)assert.equal(bounds(`Poster_${p}`).intersectsBox(bounds(`Sconce_-1_${l}`)),false);
    assert.ok(bounds('StageMic').min.x>.8,'microphone outside neutral gesture envelope');
    const meshes=new Set<import('three').BufferGeometry>();model.scene.traverse(n=>{if(n instanceof Mesh)meshes.add(n.geometry);});meshes.forEach(g=>g.dispose());
  } finally { names.forEach((n,i)=>{const d=original[i];if(d)Object.defineProperty(globalThis,n,d);else Reflect.deleteProperty(globalThis,n);}); }
});

test('sculpted rig has smooth joint weights and keeps hands attached across the full demonstration', async () => {
  const b=await fs.readFile(base+'models/actor.glb'), model=await parseClubModel(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const mesh=model.scene.getObjectByName('BodySurface') as SkinnedMesh;
  assert.ok(mesh.isSkinnedMesh);const weights=mesh.geometry.getAttribute('skinWeight');let blends=0;
  for(let i=0;i<weights.count;i++){assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);if(weights.getY(i)>.05&&weights.getX(i)>.05)blends++;}
  assert.ok(blends>100,'smooth shoulder/elbow/knee deformation, not rigid primitive pieces');
  const {loadActor}=await import('./actor-loader');const actor=await loadActor(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),CLUB_MAPPING),take=syntheticTake(),scale=mappingScale(CLUB_MAPPING.heightMetres,take.calibration.headHeight);
  const body=actor.scene.getObjectByName('BodySurface') as SkinnedMesh, positions=body.geometry.getAttribute('position');
  const cuffs=[-1,1].map(sign=>Array.from({length:positions.count},(_,i)=>i).filter(i=>positions.getX(i)*sign>.47&&positions.getY(i)>.905&&positions.getY(i)<.95));
  cuffs.forEach(c=>assert.ok(c.length>5));
  for(let ms=0;ms<=12000;ms+=100){const poses=sampleRecording(take,ms),raw=JSON.stringify(poses);actor.apply(poses,scale);assert.equal(JSON.stringify(poses),raw);actor.scene.updateMatrixWorld(true);body.skeleton.update();
    for(const [index,name] of ['LeftHand','RightHand'].entries()) {const bone=actor.scene.getObjectByName(name)!,center=new Vector3();for(const i of cuffs[index])center.add(body.getVertexPosition(i,new Vector3()));center.divideScalar(cuffs[index].length);body.localToWorld(center);assert.ok(center.distanceTo(bone.getWorldPosition(new Vector3()))<.06,'posed cuff remains joined to measured wrist');}
  }
  const lean=sampleRecording(take,1000);lean.head={...lean.head!,position:[.15,1.66,-.09]};actor.apply(lean,scale);
  const spine=actor.scene.getObjectByName('Spine')!,angle=spine.quaternion.angleTo(new Quaternion());assert.ok(angle>.05&&angle<=.351);
  assert.ok(actor.scene.getObjectByName('Head')!.getWorldPosition(new Vector3()).distanceTo(new Vector3(...lean.head.position).multiplyScalar(scale))<1e-6);
  actor.dispose();mesh.geometry.dispose();
});

test('authored seated poses fit the cushion without deep penetration or floating feet', async () => {
  const b=await fs.readFile(base+'models/audience-01.glb'),model=await parseClubModel(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const mixer=new AnimationMixer(model.scene),body=model.scene.getObjectByName('BodySurface') as SkinnedMesh;
  const cushion=new Box3(new Vector3(-.24,.435,-.22),new Vector3(.24,.525,.22));
  for(const name of ['seated-idle','listen','laugh','clap']){
    mixer.stopAllAction();mixer.clipAction(model.animations.find(a=>a.name===name)!).play();
    for(let time=0;time<=4;time+=.5){mixer.setTime(time);model.scene.updateMatrixWorld(true);body.skeleton.update();let floor=Infinity;
      for(let i=0;i<body.geometry.getAttribute('position').count;i++){const p=body.getVertexPosition(i,new Vector3());floor=Math.min(floor,p.y);if(cushion.containsPoint(p))assert.ok(p.y>=.515,`${name}: more than 10mm cushion compression`);}
      assert.ok(floor>=-.005&&floor<.04,`${name}: shoes must stay at the floor`);
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(model.scene);model.scene.traverse(n=>{if(n instanceof Mesh)n.geometry.dispose();});
});
test('failed asset load releases fulfilled resources and never silently substitutes an empty scene', async () => {
  const room = buildTheatre(); await assert.rejects(room.load(async () => { throw new Error('missing asset'); }), /missing asset/); room.dispose();
  await assert.rejects(parseClubModel(new ArrayBuffer(20)), /GLB/);
});
