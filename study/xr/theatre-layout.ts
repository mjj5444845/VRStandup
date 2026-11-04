import { AnimationMixer, Color, DataTexture, DirectionalLight, Group, HemisphereLight, InstancedMesh, LinearFilter, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ACTOR_ORIGIN, PREVIEW_SEAT, theatreSeats } from '../core/theatre';
import { CLUB_BASE, CLUB_MAPPING } from '../core/club-assets';
import type { Joint, Pose } from '../core/motion';
import type { Mapping } from '../core/materials';
import { createMappingDriver } from './mapping';
import { disposeClub, instanceScenery, parseClubModel } from './club-loader';
import { createArmEstimate, createTorsoEstimate } from './estimated-arms';
export type ClubModel = Awaited<ReturnType<typeof parseClubModel>>;
type Audience = { root: Object3D; mixer: AnimationMixer; idle: AnimationClip; laugh: AnimationClip; mode: string };
export function buildTheatre() {
  const root = new Group(), actor = new Group(), seats = theatreSeats(), audience: Object3D[] = [], animated: Audience[] = [], resources: Object3D[] = [];
  root.name = 'SoftClayClub'; actor.position.fromArray(ACTOR_ORIGIN); actor.rotation.y = Math.PI; root.add(actor);
  let disposed = false, driver: ReturnType<typeof createMappingDriver> | null = null, arms: ReturnType<typeof createArmEstimate> | null = null, torso: ReturnType<typeof createTorsoEstimate> | null = null, currentSeat = PREVIEW_SEAT, savedCalls = 0;
  const ambient = new HemisphereLight('#fff0d5', '#77806c', 1.25), key = new DirectionalLight('#ffe1b3', 4.5);
  key.position.set(0, 3.3, -2.1); key.target.position.set(0, 1.6, -3.78); root.add(ambient, key, key.target);
  // Soft contact patches ground static seating without an extra real-time shadow pass on Quest.
  const pixels = new Uint8Array(64*64*4);
  for (let y=0;y<64;y++) for(let x=0;x<64;x++) { const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5); pixels.set([45,34,23,Math.round(Math.max(0,1-r)**2*80)],i); }
  const contactTexture = new DataTexture(pixels,64,64); contactTexture.magFilter=contactTexture.minFilter=LinearFilter;contactTexture.needsUpdate=true;
  const contact = new InstancedMesh(new PlaneGeometry(1,1),new MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false}),25);contact.name='SoftContactShadows';
  const ground = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
  seats.forEach((s,i)=>contact.setMatrixAt(i,new Matrix4().compose(new Vector3(s.position[0],.004,s.position[2]-.06),ground,new Vector3(.82,.9,1))));
  contact.setMatrixAt(24,new Matrix4().compose(new Vector3(0,.369,-3.78),ground,new Vector3(.62,.5,1)));contact.instanceMatrix.needsUpdate=true;root.add(contact);
  function install(models: ClubModel[]) {
    if (disposed) { disposeClub(models.map(m => m.scene)); throw new Error('场景已经关闭。'); }
    if (driver || models.length !== 7) throw new Error('场景模型清单无效或重复安装。');
    resources.push(...models.map(m => m.scene)); const scenery = models[0].scene;
    for (const seat of seats) { const node = scenery.getObjectByName(seat.name); if (!node || node.position.distanceTo(new Vector3(...seat.position)) > .001) throw new Error(`座位与场景不一致：${seat.name}`); }
    savedCalls = instanceScenery(scenery); root.add(scenery); actor.add(models[1].scene); driver = createMappingDriver(actor, CLUB_MAPPING); arms = createArmEstimate(actor); torso = createTorsoEstimate(actor);
    for (const seat of seats) {
      const template = models[2 + seat.id % 5], character = clone(template.scene), mixer = new AnimationMixer(character);
      const idle = template.animations.find(a => a.name === 'seated-idle'), laugh = template.animations.find(a => a.name === 'laugh');
      if (!idle || !laugh) throw new Error('观众缺少坐姿或笑声动作。');
      const wrapper = new Group(); wrapper.name = `Audience_${seat.id}`; wrapper.position.fromArray(seat.position); wrapper.add(character); wrapper.visible = seat.id !== currentSeat;
      root.add(wrapper); audience.push(wrapper); animated.push({ root: character, mixer, idle, laugh, mode: idle.name }); mixer.clipAction(idle).play(); mixer.setTime(1);
    }
  }
  async function load(fetchModel: (id: string) => Promise<ClubModel> = async id => {
    const response = await fetch(`${CLUB_BASE}/models/${id}.glb`, { cache: 'no-cache' }); if (!response.ok) throw new Error(`无法载入场景资产 ${id} (${response.status})`);
    return parseClubModel(await response.arrayBuffer());
  }) {
    const settled = await Promise.allSettled(['scene-empty', 'actor', 'audience-01', 'audience-02', 'audience-03', 'audience-04', 'audience-05'].map(fetchModel));
    const models = settled.flatMap(r => r.status === 'fulfilled' ? [r.value] : []), failed = settled.find(r => r.status === 'rejected');
    if (failed) { disposeClub(models.map(m => m.scene)); throw failed.reason; }
    try { install(models); } catch (e) { dispose(); throw e; }
  }
  function apply(poses: Record<Joint, Pose | null>, scale: number, estimatedArms = true) {
    if (!driver) throw new Error('演员模型尚未载入。'); torso?.reset(); arms?.reset(); driver.reset(); if (estimatedArms) { torso?.apply(poses,scale,driver.mapping); arms?.apply(poses, scale, driver.mapping); } const validity = driver.apply(poses, scale); actor.visible = validity.head;
    for (const joint of ['head', 'leftHand', 'rightHand'] as const) { const surface = actor.getObjectByName(`${joint === 'head' ? 'Head' : joint === 'leftHand' ? 'LeftHand' : 'RightHand'}Surface`); if (surface) surface.visible = validity[joint]; }
  }
  function configure(mapping: Mapping) {
    if (!driver || mapping.modelId !== CLUB_MAPPING.modelId || mapping.modelVersion !== CLUB_MAPPING.modelVersion) throw new Error('需要已载入的 Soft Clay Club v1 演员。');
    torso?.reset(); arms?.reset(); driver.reset(); driver = createMappingDriver(actor, mapping);
  }
  function point(joint: Joint) { if (!driver) throw new Error('演员模型尚未载入。'); return actor.getObjectByName(driver.mapping.nodes[joint])!.getWorldPosition(new Vector3()); }
  function reaction(timeMs: number, active: boolean) {
    for (let i = 0; i < animated.length; i++) { const a = animated[i], clip = active ? a.laugh : a.idle;
      if (a.mode !== clip.name) { a.mixer.stopAllAction(); a.mixer.clipAction(clip).play(); a.mode = clip.name; } a.mixer.setTime((timeMs / 1000 + i * .173) % clip.duration);
    }
  }
  function view(index: number) { if (!seats[index]) throw new Error('座位编号无效。'); currentSeat = index; audience.forEach((a, i) => { a.visible = i !== index; }); }
  function dispose() { if (disposed) return; disposed = true; animated.forEach(a => { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.root); }); disposeClub([root, ...resources]); audience.length = 0; animated.length = 0; }
  return { root, actor, audience, seats, background: new Color('#e5dbc9'), load, apply, configure, point, reaction, view, dispose, get savedCalls() { return savedCalls; }, get heightMetres() { return driver?.mapping.heightMetres ?? CLUB_MAPPING.heightMetres; } };
}
