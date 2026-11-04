import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Mapping } from '../core/materials';
import { createMappingDriver } from './mapping';
import { assert, object } from '../core/validation';
import type { Joint, Pose } from '../core/motion';
import { createArmEstimate, createTorsoEstimate } from './estimated-arms';
import { createHumanDriver, hasHumanRig } from './human-driver';
import { CLUB_MAPPING } from '../core/club-assets';
/** Only self-contained GLB is accepted; importing a model must not fetch arbitrary remote URLs. */
export async function loadActor(bytes: ArrayBuffer, mapping: Mapping) {
  assert(bytes.byteLength >= 20 && bytes.byteLength <= 64 * 1024 * 1024, '演员 GLB 文件无效或超过 64 MiB 工程上限。'); const view = new DataView(bytes);
  assert(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.byteLength && view.getUint32(16, true) === 0x4e4f534a, '需要 glTF 2.0 自包含 GLB。');
  const length = view.getUint32(12, true); assert(length + 20 <= bytes.byteLength, 'GLB JSON 块长度无效。');
  const json: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))); assert(object(json), '模型 JSON 无效。');
  for (const key of ['images', 'buffers']) { const entries = json[key]; assert(entries === undefined || Array.isArray(entries) && entries.every(e => object(e) && e.uri === undefined), '当前演员导入要求所有纹理和缓冲都嵌入 GLB，不能引用外部网址。'); }
  assert(!Array.isArray(json.extensionsRequired) || json.extensionsRequired.length === 0, '当前最小驱动尚不加载额外压缩/材质扩展，请先导出基础 GLB。');
  const declaredHuman=Array.isArray(json.nodes)&&json.nodes.some(n=>object(n)&&object(n.extras)&&n.extras.humanRig===3);
  assert(!declaredHuman||mapping.modelId===CLUB_MAPPING.modelId&&mapping.modelVersion===CLUB_MAPPING.modelVersion,'新人体需要v3映射，请重新准备模型工作副本。');
  const gltf = await new GLTFLoader().parseAsync(bytes, ''), driver = createMappingDriver(gltf.scene, mapping);
  const anatomical=hasHumanRig(gltf.scene);
  const human=anatomical?createHumanDriver(gltf.scene,mapping):null;
  const arms = !human && mapping.modelId === 'actor' && mapping.modelVersion === 'v1-candidate' && ['LeftUpperArm','RightUpperArm','LeftLowerArm','RightLowerArm','LeftHand','RightHand'].every(n => gltf.scene.getObjectByName(n)) ? createArmEstimate(gltf.scene) : null;
  const torso=arms&&gltf.scene.getObjectByName('Spine')?createTorsoEstimate(gltf.scene):null;
  function apply(poses: Record<Joint, Pose | null>, scale: number) { if(human)return human.apply(poses,scale);torso?.reset(); arms?.reset(); driver.reset(); torso?.apply(poses,scale,driver.mapping); arms?.apply(poses,scale,driver.mapping); return driver.apply(poses,scale); }
  return { scene: gltf.scene, animations: gltf.animations, driver, apply, dispose: () => { gltf.scene.traverse(node => { if ('geometry' in node && object(node.geometry) && 'dispose' in node.geometry && typeof node.geometry.dispose === 'function') node.geometry.dispose(); if ('material' in node) { const ms = Array.isArray(node.material) ? node.material : [node.material]; for (const m of ms) if (m && typeof m === 'object' && 'dispose' in m && typeof m.dispose === 'function') { for (const value of Object.values(m)) if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture && 'dispose' in value && typeof value.dispose === 'function') value.dispose(); m.dispose(); } } }); } };
}
