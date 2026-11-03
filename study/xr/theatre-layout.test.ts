import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Mesh, Raycaster, SkinnedMesh, Vector3 } from 'three';
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
test('failed asset load releases fulfilled resources and never silently substitutes an empty scene', async () => {
  const room = buildTheatre(); await assert.rejects(room.load(async () => { throw new Error('missing asset'); }), /missing asset/); room.dispose();
  await assert.rejects(parseClubModel(new ArrayBuffer(20)), /GLB/);
});
