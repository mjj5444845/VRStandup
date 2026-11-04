import { ACESFilmicToneMapping, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { PREVIEW_SEAT } from '../core/theatre';
import { buildTheatre } from './theatre-layout';
import { syntheticTake } from '../core/synthetic-take';
import { sampleRecording } from '../core/recording';
import { mappingScale } from './mapping';

export type InspectionView = 'room' | 'front' | 'portrait' | 'side' | 'back' | 'seated' | 'top' | 'hands' | 'seat' | 'stage' | 'access';
export type InspectionMotion = 'tracking' | 'standing-idle' | 'talk' | 'explain' | 'wave';
/** Same shipped meshes, rig and mapping as the participant renderer, without study logging. */
export function createSceneInspector(host: HTMLElement, changed: (message: string) => void) {
  const renderer = new WebGLRenderer({ antialias: true }), scene = new Scene(), room = buildTheatre(), camera = new PerspectiveCamera(42, 1, .05, 40);
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  scene.background = room.background; scene.add(room.root);
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; renderer.domElement.setAttribute('aria-label', '人物与场景多视角检查');
  const take = syntheticTake(), scale = mappingScale(room.heightMetres, take.calibration.headHeight);
  let disposed = false, ready = false, view: InspectionView = 'front', motion:InspectionMotion='talk', time = 1, playing = false, previous = 0, seat = PREVIEW_SEAT, eyeHeight = 1.2;
  function resize() { const b = host.getBoundingClientRect(); renderer.setSize(b.width, b.height, false); camera.aspect = b.width / Math.max(1, b.height); camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function select(next: InspectionView) {
    view = next;
    const contextual = ['room','top','seated','seat','stage','access'].includes(view);
    room.root.children.forEach(n => { if (n === room.actor || 'isLight' in n || n.type.endsWith('Light') || n.type === 'Object3D') return; n.visible = contextual; });
    room.actor.visible = true;
    room.view(seat);
    if (view === 'front' || view === 'portrait' || view === 'side' || view === 'back' || view === 'hands') room.audience.forEach(n => { n.visible = false; });
    for (const name of ['RoomCeiling', 'RoomFrontWall']) { const n = room.root.getObjectByName(name); if (n) n.visible = !['room','top'].includes(view); }
    if (view === 'top') { for (const name of ['RoomLeftWall','RoomRightWall','RoomBackWall']) { const n=room.root.getObjectByName(name); if(n)n.visible=false; } }
    else { for (const name of ['RoomLeftWall','RoomRightWall','RoomBackWall']) { const n=room.root.getObjectByName(name); if(n)n.visible=true; } }
    const cameras: Record<InspectionView, [number[], number[]]> = {
      room: [[0,2.8,4.9],[0,1.05,-1.5]], front:[[0,1.55,-.7],[0,1.30,-3.78]], portrait:[[.38,2.03,-2.85],[0,1.92,-3.78]], side:[[3.2,1.55,-3.78],[0,1.3,-3.78]],
      back:[[0,1.55,-6.9],[0,1.3,-3.78]], seated:[[-3.5,1.45,.5],[-2.34,.75,-1.08]], top:[[0,18.5,.01],[0,0,0]],hands:[[.8,1.6,-2.75],[0,1.48,-3.66]],
      seat: [[room.seats[seat].position[0],eyeHeight,room.seats[seat].position[2]],[0,2,-3.78]],
      stage: [[0,2.05,-3.55],[0,1.2,2.1]], access: [[2.8,2.1,-.1],[4,.7,-3.9]],
    };
    const [eye,target] = cameras[view]; camera.position.fromArray(eye); camera.lookAt(new Vector3().fromArray(target));
    camera.fov = view === 'seat' ? 58 : 42; camera.updateProjectionMatrix();
    if (ready) changed(view === 'seat' ? `座位 ${seat+1} · 工程眼高 ${eyeHeight.toFixed(2)} 米 · 只隐藏本人；坐姿与头显观感仍需实测。` : '实际运行资产与统一灯光。全场/俯视为剖开检查，其余空间视角保留墙顶。');
  }
  void room.load().then(() => { if(disposed)return; ready=true;select(view);changed('已加载实际发布的场景和人物。拖动动作进度，检查手臂、衣袖和座椅。'); }).catch(e => changed(String(e)));
  renderer.setAnimationLoop(now => {
    if(disposed)return; if(playing&&previous)time=(time+Math.min(.05,(now-previous)/1000))%12;previous=now;
    if(ready){if(motion==='tracking')room.apply(sampleRecording(take,time*1000),scale,true);else room.authored(motion,time);room.reaction(time*1000,false);room.root.traverse(n=>{if(n instanceof Mesh&&'isSkinnedMesh' in n)n.frustumCulled=false;});}
    renderer.render(scene,camera);
  });
  return { select, seat(index:number,height:number){if(!room.seats[index]||!Number.isFinite(height)||height<1||height>1.6)throw Error('检查座位或眼高无效');seat=index;eyeHeight=height;select('seat');}, motion(value:InspectionMotion){motion=value;time=1;},time(value:number){time=value;}, play(value:boolean){playing=value;}, dispose(){disposed=true;observer.disconnect();renderer.setAnimationLoop(null);room.dispose();renderer.dispose();renderer.domElement.remove();} };
}
