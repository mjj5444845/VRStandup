import { BoxGeometry, Color, GridHelper, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer } from 'three';
import type { PlaybackAudio } from '../core/audio-interface';
import { INITIAL_TRANSPORT, pauseStalledTransport, pauseTransport, startTransport, transportTime, type Transport } from '../core/motion';
import { sampleRecording, validateRecording, waveBytes, type RecordedTake } from '../core/recording';
import { REFERENCE_MAPPING } from '../core/demo';
import { createMappingDriver, mappingScale } from './mapping';
import { loadActor } from './actor-loader';
import type { Mapping } from '../core/materials';
export function createReview(host: HTMLElement, audio: PlaybackAudio, changed: (value: { message: string; progressMs: number; playing: boolean }) => void) {
  const renderer = new WebGLRenderer({ antialias: true }), scene = new Scene(), camera = new PerspectiveCamera(50, 1, .1, 40); scene.background = new Color('#e7eee7');
  const root = new Group(), grid = new GridHelper(8, 16), geometries = [new BoxGeometry(.25, .3, .25), new SphereGeometry(.07, 12, 10)];
  const materials = ['#33775f', '#438ebc', '#c68a29'].map(color => new MeshStandardMaterial({ color }));
  ['head', 'leftHand', 'rightHand'].forEach((name, i) => { const mesh = new Mesh(geometries[i === 0 ? 0 : 1], materials[i]); mesh.name = name; mesh.visible = false; root.add(mesh); });
  scene.add(root, grid, new HemisphereLight('#ffffff', '#73847b', 3)); let driver = createMappingDriver(root, REFERENCE_MAPPING), actor: Awaited<ReturnType<typeof loadActor>> | undefined, modelGeneration = 0;
  let take: RecordedTake | null = null, transport: Transport = { ...INITIAL_TRANSPORT }, previous = 0, disposed = false, lost = false, generation = 0, last = 0;
  const position = () => take ? transportTime(transport, audio.time(), take.durationMs) : 0;
  const publish = (message: string) => { if (!disposed) changed({ message, progressMs: position(), playing: transport.phase === 'playing' }); };
  function pause(message = '已暂停，切换视角不会改变进度。') { if (take && transport.phase === 'playing') { transport = pauseTransport(transport, audio.time(), take.durationMs); audio.pause(); publish(message); } }
  async function load(value: unknown) {
    if (lost) throw new Error('三维画面已丢失，请刷新后读取原件。'); const checked = validateRecording(value), id = ++generation;
    pause(); take = null; transport = { ...INITIAL_TRANSPORT }; root.visible = false; if (actor) actor.scene.visible = false;
    if (actor) mappingScale(driver.mapping.heightMetres, checked.calibration.headHeight);
    await audio.load(waveBytes(checked)); if (disposed || generation !== id) return; if (lost) { audio.dispose(); throw new Error('画面已丢失，请刷新。'); }
    take = checked; root.visible = !actor; publish(checked.interrupted ? '中断片段已载入，只供复查。' : '片段已载入；预览只显示头手目标，不代表正式人体。');
  }
  async function play() { if (lost) throw new Error('三维画面已丢失，请刷新。'); if (!take || disposed) return; if (transport.phase === 'ended') transport = { ...INITIAL_TRANSPORT }; const id = generation, anchor = await audio.play(transport.offsetMs); if (disposed || id !== generation) return; transport = startTransport(transport, anchor, take.durationMs); previous = transport.offsetMs; publish('正在按声音时钟回放。'); }
  function view(side: 'front' | 'left' | 'right') { camera.position.set(side === 'left' ? -3 : side === 'right' ? 3 : 0, 2, 4); camera.lookAt(0, 1.2, 0); }
  function resize() { if (disposed) return; renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); }
  function tick() {
    if (disposed) return;
    if (take) {
      if (transport.phase === 'playing') {
        const raw = transport.offsetMs + Math.max(0, audio.time() - transport.anchorS) * 1000, stalled = pauseStalledTransport(transport, previous, raw, take.durationMs);
        if (stalled) { transport = stalled; audio.pause(); publish('画面有长停顿，已保留最后可靠进度。'); }
        else if (!audio.running()) pause('声音已被暂停，请手动继续。');
        else { previous = raw; if (position() >= take.durationMs) { transport = { phase: 'ended', offsetMs: take.durationMs, anchorS: audio.time() }; audio.pause(); publish('回放结束。请复查缺失/估算标记及实际音质。'); } }
      }
      const poses = sampleRecording(take, position()), validity = actor ? actor.apply(poses, mappingScale(driver.mapping.heightMetres, take.calibration.headHeight)) : driver.apply(poses, 1);
      if (actor) actor.scene.visible = Object.values(validity).every(Boolean);
      if (performance.now() - last > 150) { last = performance.now(); publish(transport.phase === 'playing' ? '正在回放' : transport.phase === 'ended' ? '回放结束' : '已载入或暂停'); }
    }
    renderer.render(scene, camera);
  }
  function hidden() { if (document.hidden) pause('页面进入后台，已暂停。'); }
  function contextLost(event: Event) { event.preventDefault(); lost = true; pause(); publish('三维画面丢失，已暂停，请刷新后重新读取原件。'); renderer.setAnimationLoop(null); }
  const observer = new ResizeObserver(resize); host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; observer.observe(host); view('front'); resize(); renderer.setAnimationLoop(tick); document.addEventListener('visibilitychange', hidden);
  async function model(bytes: ArrayBuffer, mapping: Mapping) {
    if (lost) throw new Error('三维画面已丢失，请刷新。'); pause(); if (take) mappingScale(mapping.heightMetres, take.calibration.headHeight); const id = ++modelGeneration, loaded = await loadActor(bytes, mapping);
    if (disposed || lost || id !== modelGeneration) { loaded.dispose(); return; }
    pause(); if (actor) { scene.remove(actor.scene); actor.dispose(); } root.visible = false; actor = loaded; driver = loaded.driver;
    if (mapping.modelId === 'actor' && mapping.modelVersion === 'v1-candidate') loaded.scene.rotation.y = Math.PI;
    scene.add(loaded.scene); publish('模型已载入：头手位置来自记录，连接的手臂为显示估算；未采集全身或手指，缺失时隐藏模型。');
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  function dispose() { if (disposed) return; disposed = true; generation++; modelGeneration++; actor?.dispose(); audio.dispose(); observer.disconnect(); document.removeEventListener('visibilitychange', hidden); renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.setAnimationLoop(null); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); }
  return { load, model, play, pause: () => pause(), view, dispose };
}
