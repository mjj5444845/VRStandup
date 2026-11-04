import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, Texture, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { object, assert } from '../core/validation';
/** Reject external resources before GLTFLoader can issue any dependent requests. */
export async function parseClubModel(bytes: ArrayBuffer) {
  assert(bytes.byteLength >= 20 && bytes.byteLength <= 64 * 1024 * 1024, '俱乐部 GLB 大小无效。');
  const v = new DataView(bytes), n = v.getUint32(12, true);
  assert(v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2 && v.getUint32(8, true) === bytes.byteLength && v.getUint32(16, true) === 0x4e4f534a && n + 20 <= bytes.byteLength, '俱乐部模型必须为 glTF 2.0 GLB。');
  const j: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, n)));
  assert(object(j), '俱乐部 GLB JSON 无效。');
  for (const key of ['images', 'buffers']) assert(j[key] === undefined || Array.isArray(j[key]) && j[key].every((e: unknown) => object(e) && e.uri === undefined), '俱乐部模型不能引用外部资源。');
  assert(j.extensionsRequired === undefined || Array.isArray(j.extensionsRequired) && j.extensionsRequired.length === 0, '俱乐部模型不支持必需扩展。');
  return new GLTFLoader().parseAsync(bytes, '');
}
/** Batch shared static geometry/material while preserving authored world transforms. */
export function instanceScenery(root: Object3D) {
  root.updateMatrixWorld(true); const inverse = new Matrix4().copy(root.matrixWorld).invert(), batches = new Map<BufferGeometry, Map<Material, Mesh[]>>();
  root.traverse(node => {
    if (!(node instanceof Mesh) || 'isSkinnedMesh' in node || Array.isArray(node.material)) return;
    // Keep cutaway walls/ceiling in their authored hierarchy for the inspection camera.
    for (let parent: Object3D | null = node; parent && parent !== root; parent = parent.parent) {
      if (/^Room(LeftWall|RightWall|BackWall|FrontWall|Ceiling)$/.test(parent.name)) return;
    }
    const byMaterial = batches.get(node.geometry) ?? new Map<Material, Mesh[]>(); batches.set(node.geometry, byMaterial);
    const list = byMaterial.get(node.material) ?? []; list.push(node); byMaterial.set(node.material, list);
  });
  let savedCalls = 0;
  for (const byMaterial of batches.values()) for (const list of byMaterial.values()) {
    if (list.length < 2) continue;
    const mesh = new InstancedMesh(list[0].geometry, list[0].material, list.length); mesh.name = `Batched_${list[0].name}`;
    list.forEach((item, i) => { mesh.setMatrixAt(i, new Matrix4().multiplyMatrices(inverse, item.matrixWorld)); item.removeFromParent(); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); root.add(mesh); savedCalls += list.length - 1;
  }
  return savedCalls;
}
/** Deduplicate resources shared by skeleton clones and instance batches. */
export function disposeClub(roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>(), meshes = new Set<Mesh>();
  roots.forEach(root => root.traverse(node => {
    if (!(node instanceof Mesh) || meshes.has(node)) return; meshes.add(node); geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => { materials.add(m); Object.values(m).forEach(v => { if (v instanceof Texture) textures.add(v); }); });
    if ('skeleton' in node && object(node.skeleton) && node.skeleton.boneTexture instanceof Texture) textures.add(node.skeleton.boneTexture);
    if (node instanceof InstancedMesh) node.dispose();
  }));
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); const image: unknown = t.source.data; if (object(image) && typeof image.close === 'function') image.close(); });
  roots.forEach(root => root.clear());
}
