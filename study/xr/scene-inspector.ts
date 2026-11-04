import { ACESFilmicToneMapping, Color, HemisphereLight, Mesh, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { buildTheatre } from './theatre-layout';
import { syntheticTake } from '../core/synthetic-take';
import { sampleRecording } from '../core/recording';
import { mappingScale } from './mapping';

export type InspectionView = 'room' | 'front' | 'portrait' | 'side' | 'back' | 'seated' | 'top';
/** Same shipped meshes, rig and mapping as the participant renderer, without study logging. */
export function createSceneInspector(host: HTMLElement, changed: (message: string) => void) {
  const renderer = new WebGLRenderer({ antialias: true }), scene = new Scene(), room = buildTheatre(), camera = new PerspectiveCamera(42, 1, .05, 40);
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  scene.background = new Color('#e8dfd1'); scene.add(room.root); const fill = new HemisphereLight('#fff4df', '#a29480', .6); scene.add(fill);
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; renderer.domElement.setAttribute('aria-label', '人物与场景多视角检查');
  const take = syntheticTake(), scale = mappingScale(room.heightMetres, take.calibration.headHeight);
  let disposed = false, ready = false, view: InspectionView = 'front', time = 1, playing = false, previous = 0;
  function resize() { const b = host.getBoundingClientRect(); renderer.setSize(b.width, b.height, false); camera.aspect = b.width / Math.max(1, b.height); camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function select(next: InspectionView) {
    view = next;
    room.root.children.forEach(n => { if (n === room.actor || 'isLight' in n || n.type.endsWith('Light') || n.type === 'Object3D') return; n.visible = view === 'room' || view === 'top' || view === 'seated'; });
    room.actor.visible = true;
    room.view(1);
    if (view === 'front' || view === 'portrait' || view === 'side' || view === 'back') room.audience.forEach(n => { n.visible = false; });
    for (const name of ['RoomCeiling', 'RoomFrontWall']) { const n = room.root.getObjectByName(name); if (n) n.visible = false; }
    if (view === 'top') { for (const name of ['RoomLeftWall','RoomRightWall','RoomBackWall']) { const n=room.root.getObjectByName(name); if(n)n.visible=false; } }
    else { for (const name of ['RoomLeftWall','RoomRightWall','RoomBackWall']) { const n=room.root.getObjectByName(name); if(n)n.visible=true; } }
    const cameras: Record<InspectionView, [number[], number[]]> = {
      room: [[0,2.8,4.9],[0,1.05,-1.5]], front:[[0,1.55,-.7],[0,1.30,-3.78]], portrait:[[.38,2.03,-2.85],[0,1.92,-3.78]], side:[[3.2,1.55,-3.78],[0,1.3,-3.78]],
      back:[[0,1.55,-6.9],[0,1.3,-3.78]], seated:[[-3.5,1.45,.5],[-2.34,.75,-1.08]], top:[[0,16,.01],[0,0,0]],
    };
    const [eye,target] = cameras[view]; camera.position.fromArray(eye); camera.lookAt(new Vector3().fromArray(target));
  }
  void room.load().then(() => { if(disposed)return; ready=true;select(view);changed('已加载实际发布的场景和人物。拖动动作进度，检查手臂、衣袖和座椅。'); }).catch(e => changed(String(e)));
  renderer.setAnimationLoop(now => {
    if(disposed)return; if(playing&&previous)time=(time+Math.min(.05,(now-previous)/1000))%12;previous=now;
    if(ready){room.apply(sampleRecording(take,time*1000),scale,true);room.reaction(time*1000,false);room.root.traverse(n=>{if(n instanceof Mesh&&'isSkinnedMesh' in n)n.frustumCulled=false;});}
    renderer.render(scene,camera);
  });
  return { select, time(value:number){time=value;}, play(value:boolean){playing=value;}, dispose(){disposed=true;observer.disconnect();renderer.setAnimationLoop(null);room.dispose();renderer.dispose();renderer.domElement.remove();} };
}
