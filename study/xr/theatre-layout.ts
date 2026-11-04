import { AnimationMixer, Color, DataTexture, DirectionalLight, Group, HemisphereLight, InstancedMesh, LinearFilter, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, SpotLight, Vector3, type AnimationClip, type Object3D } from 'three';
import { CLUB_LIGHTING } from '../core/club-lighting';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ACTOR_ORIGIN, PREVIEW_SEAT, theatreSeats } from '../core/theatre';
import { CLUB_BASE, CLUB_MAPPING } from '../core/club-assets';
import type { Joint, Pose } from '../core/motion';
import type { Mapping } from '../core/materials';
import { createMappingDriver } from './mapping';
import { disposeClub, instanceScenery, parseClubModel } from './club-loader';
import { createArmEstimate, createTorsoEstimate } from './estimated-arms';
import { createHumanDriver, hasHumanRig } from './human-driver';
export type ClubModel = Awaited<ReturnType<typeof parseClubModel>>;
type Audience = { root: Object3D; mixer: AnimationMixer; idle: AnimationClip; laugh: AnimationClip; mode: string };
export function buildTheatre() {
  const root = new Group(), actor = new Group(), seats = theatreSeats(), audience: Object3D[] = [], animated: Audience[] = [], resources: Object3D[] = [];
  root.name = 'SoftClayClub'; actor.position.fromArray(ACTOR_ORIGIN); actor.rotation.y = Math.PI; root.add(actor);
  let human: ReturnType<typeof createHumanDriver> | null=null, actorMixer: AnimationMixer | null=null, actorClips: AnimationClip[]=[];
  let disposed = false, driver: ReturnType<typeof createMappingDriver> | null = null, arms: ReturnType<typeof createArmEstimate> | null = null, torso: ReturnType<typeof createTorsoEstimate> | null = null, currentSeat = PREVIEW_SEAT, savedCalls = 0;
  const light = CLUB_LIGHTING;
  const ambient = new HemisphereLight(light.ambient.sky, light.ambient.ground, light.ambient.intensity);
  const fill = new DirectionalLight(light.fill.colour, light.fill.intensity);
  fill.position.fromArray(light.fill.position); root.add(ambient, fill, fill.target);
  for (const preset of light.spots) {
    const spot = new SpotLight(preset.colour, preset.intensity, light.distance, light.angle, light.penumbra, light.decay);
    spot.name = preset.name; spot.position.fromArray(preset.position); spot.target.position.fromArray(preset.target);
    root.add(spot, spot.target);
  }
  // Soft contact patches ground static seating without an extra real-time shadow pass on Quest.
  const pixels = new Uint8Array(64*64*4);
  for (let y=0;y<64;y++) for(let x=0;x<64;x++) { const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5); pixels.set([45,34,23,Math.round(Math.max(0,1-r)**2*light.contactOpacity)],i); }
  const contactTexture = new DataTexture(pixels,64,64); contactTexture.magFilter=contactTexture.minFilter=LinearFilter;contactTexture.needsUpdate=true;
  const contact = new InstancedMesh(new PlaneGeometry(1,1),new MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false}),34);contact.name='SoftContactShadows';
  const ground = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
  seats.forEach((s,i)=>contact.setMatrixAt(i,new Matrix4().compose(new Vector3(s.position[0],.004,s.position[2]-.06),ground,new Vector3(.82,.9,1))));
  contact.setMatrixAt(24,new Matrix4().compose(new Vector3(0,.369,-3.78),ground,new Vector3(.62,.5,1)));
  // Furniture contact patches share one draw call with seat/performer patches.
  const patches = [
    [-1.55,.004,-1.25,1.1,1.1], [1.55,.004,-1.25,1.1,1.1],
    [-1.55,.004,.48,1.1,1.1], [1.55,.004,.48,1.1,1.1],
    [4.53,.004,-1.4,.65,1.3], [0,.004,4.72,1.6,.8],
    [-2.95,.361,-4.13,.55,.65], [2.95,.361,-4.13,.55,.65], [1.15,.369,-3.65,.45,.45],
  ];
  patches.forEach(([x,y,z,w,d],i)=>contact.setMatrixAt(25+i,new Matrix4().compose(new Vector3(x,y,z),ground,new Vector3(w,d,1))));
  contact.instanceMatrix.needsUpdate=true;root.add(contact);
  function install(models: ClubModel[]) {
    if (disposed) { disposeClub(models.map(m => m.scene)); throw new Error('场景已经关闭。'); }
    if (driver || models.length !== 7) throw new Error('场景模型清单无效或重复安装。');
    resources.push(...models.map(m => m.scene)); const scenery = models[0].scene;
    for (const seat of seats) { const node = scenery.getObjectByName(seat.name); if (!node || node.position.distanceTo(new Vector3(...seat.position)) > .001) throw new Error(`座位与场景不一致：${seat.name}`); }
    savedCalls = instanceScenery(scenery); root.add(scenery); actor.add(models[1].scene); driver = createMappingDriver(actor, CLUB_MAPPING);
    if(hasHumanRig(actor))human=createHumanDriver(actor,CLUB_MAPPING);else{arms=createArmEstimate(actor);torso=createTorsoEstimate(actor);}actorMixer=new AnimationMixer(actor);actorClips=models[1].animations;
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
    if (!driver) throw new Error('演员模型尚未载入。'); actorMixer?.stopAllAction();if(human){const validity=human.apply(poses,scale);actor.visible=validity.head;return;}torso?.reset(); arms?.reset(); driver.reset(); if (estimatedArms) { torso?.apply(poses,scale,driver.mapping); arms?.apply(poses, scale, driver.mapping); } const validity = driver.apply(poses, scale); actor.visible = validity.head;
    for (const joint of ['head', 'leftHand', 'rightHand'] as const) { const surface = actor.getObjectByName(`${joint === 'head' ? 'Head' : joint === 'leftHand' ? 'LeftHand' : 'RightHand'}Surface`); if (surface) surface.visible = validity[joint]; }
  }
  function configure(mapping: Mapping) {
    if (!driver || mapping.modelId !== CLUB_MAPPING.modelId || mapping.modelVersion !== CLUB_MAPPING.modelVersion) throw new Error('需要已载入的 Soft Clay Club v1 演员。');
    human?.reset();torso?.reset(); arms?.reset(); driver.reset(); driver = createMappingDriver(actor, mapping);if(human)human=createHumanDriver(actor,mapping);
  }
  function point(joint: Joint) { if (!driver) throw new Error('演员模型尚未载入。'); return actor.getObjectByName(driver.mapping.nodes[joint])!.getWorldPosition(new Vector3()); }
  function authored(name:string,time:number){if(!actorMixer)return;const clip=actorClips.find(a=>a.name===name);if(!clip)throw Error('动作不存在');human?.reset();actorMixer.stopAllAction();actorMixer.clipAction(clip).play();actorMixer.setTime(time%clip.duration);actor.visible=true;for(const name of ['HeadSurface','LeftHandSurface','RightHandSurface']){const surface=actor.getObjectByName(name);if(surface)surface.visible=true;}}
  function reaction(timeMs: number, active: boolean) {
    for (let i = 0; i < animated.length; i++) { const a = animated[i], clip = active ? a.laugh : a.idle;
      if (a.mode !== clip.name) { a.mixer.stopAllAction(); a.mixer.clipAction(clip).play(); a.mode = clip.name; } a.mixer.setTime((timeMs / 1000 + i * .173) % clip.duration);
    }
  }
  function view(index: number) { if (!seats[index]) throw new Error('座位编号无效。'); currentSeat = index; audience.forEach((a, i) => { a.visible = i !== index; }); }
  function dispose() { if (disposed) return; disposed = true;actorMixer?.stopAllAction();actorMixer?.uncacheRoot(actor); animated.forEach(a => { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.root); }); disposeClub([root, ...resources]); audience.length = 0; animated.length = 0; }
  return { root, actor, audience, seats, background: new Color(light.background), load, apply, authored, configure, point, reaction, view, dispose, get savedCalls() { return savedCalls; }, get heightMetres() { return driver?.mapping.heightMetres ?? CLUB_MAPPING.heightMetres; } };
}
