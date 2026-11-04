import { ACESFilmicToneMapping, DoubleSide, Euler, Group, Line, BufferGeometry, LineBasicMaterial, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer, TextureLoader, SRGBColorSpace, type Texture, type XRTargetRaySpace } from 'three';
import { captionPermissions } from '../core/conditions';
import { contextKey, type OrientationSample } from '../core/execution';
import type { PlaybackAudio } from '../core/audio-interface';
import { INITIAL_TRANSPORT, pauseTransport, startTransport, transportTime, type Pose, type Transport, type Vec3 } from '../core/motion';
import type { Cue } from '../core/materials';
import type { SceneCallbacks, SceneLoad, ScenePanel } from '../core/scene-interface';
import { waveBytes } from '../core/recording';
import { samplePrepared } from '../core/sync';
import { visibleCues } from '../core/timeline';
import { PREVIEW_SEAT, actorPoint, advanceFlight, releaseVelocity, stretchScale, type Flight } from '../core/theatre';
import { CLUB_BASE, CLUB_CAPTIONS, CLUB_SOUNDS } from '../core/club-assets';
import { fixedSeatRig } from '../core/viewer';
import { desktopView } from '../core/desktop-view';
import { mappingScale } from './mapping';
import { buildTheatre } from './theatre-layout';
import { createScenePanel } from './panel';
type Glyph = { cue: Cue; mesh: Mesh<PlaneGeometry, MeshBasicMaterial>; texture: Texture; presented: boolean; mode: 'free' | 'held' | 'attached' | 'flight' | 'landed'; holders: Set<string>; scale: number; stretch: { distance: number; scale: number } | null; flight: Flight | null; velocity: Vec3; last: Vec3; lastTime: number };
const xyz = (v: Vector3): Vec3 => [v.x, v.y, v.z];
export function createTheatre(host: HTMLElement, audio: PlaybackAudio & { reaction?: (offsetMs?: number, durationMs?: number, assetId?: string) => void }, callbacks: SceneCallbacks) {
  const renderer = new WebGLRenderer({ antialias: true }), scene = new Scene(), camera = new PerspectiveCamera(58, 1, .05, 35), rig = new Group(), room = buildTheatre();
  scene.background = room.background; scene.add(room.root, rig); rig.add(camera); camera.position.set(0, 1.2, 0); renderer.toneMapping = ACESFilmicToneMapping; renderer.outputColorSpace = SRGBColorSpace; renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  const panel = createScenePanel(), ray = new Raycaster(), pointer = new Vector2(); scene.add(panel.mesh);
  const cache = new Map<string, Map<string, Glyph>>(), hands = new Map<string, Vector3>(), held = new Map<string, Glyph>(), controllers: XRTargetRaySpace[] = [];
  const lineGeometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -8)]), lineMaterial = new LineBasicMaterial({ color: '#f8f3c5' });
  let loaded: SceneLoad | null = null, glyphs = new Map<string, Glyph>(), transport: Transport = { ...INITIAL_TRANSPORT }, ready = false, disposed = false, generation = 0, previousMs = -1, previousFrame = 0, lastPublish = 0, lastProgress = 0, lastSample = 0;
  let samples: OrientationSample[] = [], message = '准备场景与声音。', xr: XRSession | null = null, xrPending = false, lost = false, fps = 0, frames = 0, frameStart = performance.now();
  let estimatedArms = false;
  let currentSeat = PREVIEW_SEAT, xrAligned = false, xrCounted = false;
  let xrEntries = 0, xrExits = 0, headTracked = false, panelLower = false; let inputTracking = { left: false, right: false };
  let looking: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
  const epoch = performance.now(); let perfFrames = 0, perfStart = 0, assetsReady = false; let currentReaction = '';
  const captionTextures = new Map<string, Texture>(); let chineseFont: FontFace | null = null;
  const assetPreparation = (async () => {
    const tasks = await Promise.allSettled([room.load(), (async () => {
      const font = new FontFace('PunchCap Chinese', 'url(' + CLUB_BASE + '/fonts/NotoSansSC-Variable.ttf)'); await font.load(); if (!disposed) { document.fonts.add(font); chineseFont = font; }
      const results = await Promise.allSettled(CLUB_CAPTIONS.map(async entry => {
        const texture = await new TextureLoader().loadAsync(CLUB_BASE + '/graphics/' + entry.id + '.png'); texture.colorSpace = SRGBColorSpace;
        if (disposed) texture.dispose(); else captionTextures.set(entry.id, texture);
      })); const error = results.find(r => r.status === 'rejected'); if (error) throw error.reason;
    })()]);
    const error = tasks.find(r => r.status === 'rejected'); if (error) throw error.reason;
    if (disposed) return; assetsReady = true; panel.refresh(); message = 'Soft Clay Club 场景已就绪。'; publish();
  })();
  void assetPreparation.catch(e => { message = '资产加载失败：' + String(e); ready = false; publish(); });
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'; renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Soft Clay Club 虚拟剧场与三维演员');
  function position() { return loaded ? transportTime(transport, audio.time(), loaded.clip.take.durationMs) : 0; }
  function publish() { if (!disposed) callbacks.changed({ ready, assetsReady, immersive: renderer.xr.isPresenting, xrEntries, xrExits, headTracked, inputs: { ...inputTracking }, playing: transport.phase === 'playing', progressMs: position(), message, fps, drawCalls: renderer.info.render.calls, captions: [...glyphs.values()].filter(g => g.mesh.visible).map(g => ({ id: g.cue.id, kind: g.cue.kind, held: g.mode === 'held', throwable: permissions(g).throw })) }); }
  function emitInteraction(g: Glyph, action: 'show' | 'hide' | 'grab' | 'release' | 'stretch' | 'throw' | 'attach' | 'land', outcome?: Flight['landed']) {
    if (!loaded) return; return callbacks.evidence({ kind: 'interaction', context: loaded.context, cueId: g.cue.id, atMs: position(), action, target: 'self', scale: g.scale, position: xyz(g.mesh.position), source: renderer.xr.isPresenting ? 'xr' : 'desktop', inputCount: Math.min(2, [...g.holders].filter(id => renderer.xr.isPresenting ? id.startsWith('xr') : id === 'mouse').length), ...(outcome ? { outcome } : {}) });
  }
  function flush() { if (loaded && samples.length) { const batch = samples; samples = []; callbacks.evidence({ kind: 'orientation', context: loaded.context, samples: batch }); } }
  function progress(ended = false) { if (loaded) { flush(); const now = performance.now(); if (perfFrames > 0 && now > perfStart) callbacks.evidence({ kind: 'performance', context: loaded.context, frames: perfFrames, elapsedMs: now - perfStart, refreshHz: xr?.frameRate ?? null, source: renderer.xr.isPresenting ? 'xr' : 'desktop' }); perfFrames = 0; perfStart = now; callbacks.evidence({ kind: 'media', context: loaded.context, positionMs: ended ? loaded.clip.take.durationMs : position(), ended }); } }
  function pause(notify = false, offset?: number) {
    currentReaction = '';
    if (transport.phase === 'playing' && loaded) {
      transport = pauseTransport(transport, audio.time(), loaded.clip.take.durationMs); audio.pause();
      if (notify) { progress(); callbacks.interrupted(message); }
    }
    if (offset !== undefined && loaded) transport = { phase: 'paused', offsetMs: offset, anchorS: audio.time() };
    publish();
  }
  function safePause(reason: string) { message = reason; pause(true); }
  async function load(input: SceneLoad) {
    if (lost || disposed) throw new Error('三维画面不可用，请重新加载。'); if (input.exercise && (input.clip.take.source !== 'test-fixture' || input.clip.manifest.kind !== 'practice' || !input.clip.manifest.id.startsWith('device-'))) throw new Error('持续花字仅限独立设备练习，不适用于实验片段。'); if (input.clip.manifest.model.modelId !== 'actor' || input.clip.manifest.model.modelVersion !== 'v1-candidate') throw new Error('本场景要求 Soft Clay Club v1 演员映射，请先在素材库整理模型。'); const id = ++generation; pause(); ready = false; samples = [];
    for (const g of glyphs.values()) { g.mesh.visible = false; if (g.mode === 'held') { g.mode = 'free'; g.holders.clear(); } } held.clear();
    if (loaded?.context.round !== input.context.round) { for (const list of cache.values()) for (const g of list.values()) destroy(g); cache.clear(); }
    loaded = input; const key = contextKey(input.context); glyphs = cache.get(key) ?? new Map(); cache.set(key, glyphs);
    transport = { phase: 'paused', offsetMs: input.offsetMs, anchorS: 0 }; previousMs = input.offsetMs - .001; lastProgress = input.offsetMs; previousFrame = 0;
    message = '正在载入剧场资产并解码声音。'; publish(); await assetPreparation; if (disposed || id !== generation) return; room.configure(input.clip.manifest.model); for (const cue of input.clip.manifest.cues) if ((cue.kind === 'expressive' || cue.kind === 'distancing') && !CLUB_CAPTIONS.some(c => c.id === cue.assetId && c.kind === cue.kind)) throw new Error('未登记的花字资产：' + cue.assetId); for (const cue of input.clip.manifest.cues) if (cue.kind === 'laugh' && cue.assetId !== 'generated-reaction' && !CLUB_SOUNDS.some(id => id === cue.assetId)) throw new Error('未登记的人群声音：' + cue.assetId); await audio.load(waveBytes(input.clip.take)); if (disposed || id !== generation) return;
    ready = true; message = '场景就绪。Soft Clay Club 演员与观众已接入；身体与表情为制作原型。'; publish();
  }
  async function play() { if (!loaded || !ready || lost || disposed) throw new Error('请先载入有效片段。'); const id = generation, anchor = await audio.play(transport.offsetMs); if (id !== generation || disposed) return; transport = startTransport(transport, anchor, loaded.clip.take.durationMs); previousFrame = 0; perfFrames = 0; perfStart = performance.now(); currentReaction = ''; message = '按声音时间播放。'; publish(); }
  function createGlyph(cue: Cue) {
    const entry = CLUB_CAPTIONS.find(c => c.id === cue.assetId && c.kind === cue.kind);
    if (!entry) throw new Error('未登记的花字资产：' + cue.assetId);
    const texture = captionTextures.get(entry.id); if (!texture) throw new Error('花字图片尚未载入。');
    const image = texture.image as { width: number; height: number }, aspect = image.width / image.height;
    const mesh = new Mesh(new PlaneGeometry(.9, .9 / aspect), new MeshBasicMaterial({ map: texture, side: DoubleSide, transparent: true, depthWrite: false, toneMapped: false })); scene.add(mesh);
    const g: Glyph = { cue, mesh, texture, presented: false, mode: 'free', holders: new Set(), scale: 1, stretch: null, flight: null, velocity: [0, 0, 0], last: [0, 0, 0], lastTime: 0 }; glyphs.set(cue.id, g); return g;
  }
  function destroy(g: Glyph) { for (const [id, value] of held) if (value === g) held.delete(id); scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); }
  function permissions(g: Glyph) { return captionPermissions(loaded?.condition ?? 'A', { kind: g.cue.kind as 'expressive' | 'distancing', throwable: g.cue.throwable }); }
  function startGrab(id: string) {
    if (panel.select(ray)) return true; if (transport.phase !== 'playing') return false;
    const object = ray.intersectObjects([...glyphs.values()].filter(g => g.mesh.visible && permissions(g).grab).map(g => g.mesh))[0]?.object;
    const g = [...glyphs.values()].find(g => g.mesh === object); if (!g) return false;
    if (!g.holders.size) { g.lastTime = 0; g.velocity = [0, 0, 0]; }
    g.holders.add(id); held.set(id, g); g.mode = 'held'; g.flight = null;
    if (g.holders.size === 2) { const h = [...g.holders].map(key => hands.get(key)); if (h[0] && h[1]) g.stretch = { distance: Math.max(.01, h[0].distanceTo(h[1])), scale: g.scale }; }
    emitInteraction(g, 'grab'); return true;
  }
  function release(id: string, assisted = false) {
    const g = held.get(id); if (!g) return; held.delete(id); g.holders.delete(id); emitInteraction(g, 'release'); g.stretch = null; if (g.holders.size) return;
    if (permissions(g).throw && Math.hypot(...g.velocity) > .4 || assisted && permissions(g).throw) {
      let velocity = g.velocity; if (assisted) { const p = g.mesh.position, t = .9; velocity = [-p.x / t, (.36 - p.y + 9.81 * t * t / 2) / t, (-3.78 - p.z) / t]; }
      g.mode = 'flight'; g.flight = { position: xyz(g.mesh.position), velocity, landed: null }; emitInteraction(g, 'throw');
    } else g.mode = 'free';
  }
  function attach() { for (const g of new Set(held.values())) if (permissions(g).attach) { for (const id of g.holders) held.delete(id); g.holders.clear(); g.mode = 'attached'; emitInteraction(g, 'attach'); } }
  function desktopRay(event: PointerEvent) { const r = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(pointer, camera); hands.set('mouse', ray.ray.at(.8, new Vector3())); }
  function pointerDown(e: PointerEvent) {
    if (renderer.xr.isPresenting) return; renderer.domElement.focus({ preventScroll: true }); desktopRay(e); renderer.domElement.setPointerCapture(e.pointerId);
    if (e.button === 0 && startGrab('mouse')) return;
    const angles = new Euler().setFromQuaternion(camera.quaternion, 'YXZ'); looking = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: angles.y, pitch: angles.x };
  }
  function pointerMove(e: PointerEvent) { if (looking && !renderer.xr.isPresenting) { const angles = desktopView(looking.yaw, looking.pitch, e.clientX - looking.x, e.clientY - looking.y); camera.rotation.set(angles.pitch, angles.yaw, 0, 'YXZ'); } desktopRay(e); }
  function pointerUp() { looking = null; release('mouse'); }
  const contextMenu = (e: Event) => e.preventDefault();
  function keyboard(e: KeyboardEvent) { if (!renderer.xr.isPresenting && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) { e.preventDefault(); const a = new Euler().setFromQuaternion(camera.quaternion, 'YXZ'), next = desktopView(a.y, a.x, e.code === 'ArrowLeft' ? -25 : e.code === 'ArrowRight' ? 25 : 0, e.code === 'ArrowUp' ? -25 : e.code === 'ArrowDown' ? 25 : 0); camera.rotation.set(next.pitch, next.yaw, 0, 'YXZ'); } if (e.code === 'KeyH') attach(); if (e.code === 'KeyT') release('mouse', true); if (e.code === 'Space') { e.preventDefault(); safePause('参与者主动暂停。'); } }
  function grabCaption() { const g = [...glyphs.values()].find(g => g.mesh.visible && permissions(g).grab); if (!g) { message = '当前没有可抓取花字。'; publish(); return; } const p = camera.getWorldPosition(new Vector3()); ray.set(p, g.mesh.position.clone().sub(p).normalize()); hands.set('mouse', p.clone().add(new Vector3(0, 0, -.8).applyQuaternion(camera.getWorldQuaternion(new Quaternion())))); startGrab('mouse'); }

  function wheel(e: WheelEvent) { const g = held.get('mouse'); if (!g) return; e.preventDefault(); g.scale = stretchScale(g.scale, 1, e.deltaY < 0 ? 1.1 : .9); emitInteraction(g, 'stretch'); }
  const controllerListeners: { controller: XRTargetRaySpace; start: () => void; end: () => void; squeeze: () => void }[] = [];
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i); controller.visible = false; rig.add(controller); controllers.push(controller); const line = new Line(lineGeometry, lineMaterial); controller.add(line);
    const start = () => { ray.set(controller.getWorldPosition(new Vector3()), new Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new Quaternion()))); hands.set(`xr${i}`, controller.getWorldPosition(new Vector3())); startGrab(`xr${i}`); }, end = () => release(`xr${i}`), squeeze = () => attach();
    controller.addEventListener('selectstart', start); controller.addEventListener('selectend', end); controller.addEventListener('squeezestart', squeeze); controllerListeners.push({ controller, start, end, squeeze });
  }
  function viewer(frame?: XRFrame): Pose | null {
    if (renderer.xr.isPresenting) {
      const ref = renderer.xr.getReferenceSpace(), pose = ref && frame?.getViewerPose(ref); if (!pose) return null;
      const p = pose.transform.position, q = pose.transform.orientation; if (!xrAligned) { const aligned = fixedSeatRig({ position: [p.x, p.y, p.z], orientation: [q.x, q.y, q.z, q.w] }, room.seats[currentSeat].position); if (aligned) { rig.position.fromArray(aligned.position); rig.rotation.set(0, aligned.yaw, 0); rig.updateMatrixWorld(true); xrAligned = true; } else message = '请平视前方，正在对齐座位。'; }
      const world = rig.localToWorld(new Vector3(p.x, p.y, p.z)), orientation = rig.getWorldQuaternion(new Quaternion()).multiply(new Quaternion(q.x, q.y, q.z, q.w)); return { position: xyz(world), orientation: [orientation.x, orientation.y, orientation.z, orientation.w] };
    }
    const q = camera.getWorldQuaternion(new Quaternion()); return { position: xyz(camera.getWorldPosition(new Vector3())), orientation: [q.x, q.y, q.z, q.w] };
  }
  function tick(now: number, frame?: XRFrame) {
    if (disposed || lost) return; const elapsed = previousFrame ? now - previousFrame : 0; previousFrame = now; frames++;
    if (now - frameStart >= 1000) { fps = frames * 1000 / (now - frameStart); frameStart = now; frames = 0; }
    const head = viewer(frame); headTracked = Boolean(head); inputTracking = { left: false, right: false }; const ref = renderer.xr.getReferenceSpace(); if (renderer.xr.isPresenting && frame && ref) for (const source of xr?.inputSources ?? []) { if ((source.handedness === 'left' || source.handedness === 'right') && frame.getPose(source.targetRaySpace, ref)) inputTracking[source.handedness] = true; }
    const viewerPosition = head ? new Vector3(...head.position) : camera.getWorldPosition(new Vector3()), viewerRotation = head ? new Quaternion(...head.orientation) : camera.getWorldQuaternion(new Quaternion());
    if (renderer.xr.isPresenting) controllers.forEach((c, i) => { if (c.visible) hands.set(`xr${i}`, c.getWorldPosition(new Vector3())); else hands.delete(`xr${i}`); });
    panel.mesh.position.copy(viewerPosition).add(new Vector3(0, 0, -1.7).applyQuaternion(viewerRotation)); panel.mesh.quaternion.copy(viewerRotation); if (panelLower) panel.mesh.position.add(new Vector3(0, -.8, 0).applyQuaternion(viewerRotation));
    if (loaded && assetsReady) {
      if (transport.phase === 'playing') perfFrames++;
      if (transport.phase === 'playing' && (elapsed > 250 || !audio.running())) { transport = { phase: 'paused', offsetMs: Math.max(0, previousMs), anchorS: audio.time() }; audio.pause(); message = elapsed > 250 ? '画面停顿超过保护间隔，已停在最后可靠进度。' : '声音时钟中断。'; progress(); callbacks.interrupted(message); }
      const ms = position(), poses = samplePrepared(loaded.clip.take, loaded.clip.manifest, ms); const scale = mappingScale(room.heightMetres, loaded.clip.take.calibration.headHeight); room.apply(poses, scale, estimatedArms && loaded.clip.take.source === 'test-fixture');
      const laugh = loaded.clip.manifest.cues.some(c => c.kind === 'laugh' && c.atMs <= ms && ms < c.endMs); room.reaction(ms, laugh);
      if (transport.phase === 'playing') {
        const reaction = loaded.clip.manifest.cues.find(c => c.kind === 'laugh' && c.atMs <= ms && ms < c.endMs); if (reaction && reaction.id !== currentReaction) audio.reaction?.(ms - reaction.atMs, reaction.endMs - ms, reaction.assetId); currentReaction = reaction?.id ?? '';
        const active = visibleCues(loaded.clip.manifest.cues, loaded.exercise === 'persistent-captions' ? 1000 : ms, loaded.condition), ids = new Set(active.map(c => c.id));
        for (const [id, g] of glyphs) if (!ids.has(id)) { if (g.presented) emitInteraction(g, 'hide'); destroy(g); glyphs.delete(id); }
        for (const cue of active) {
          const g = glyphs.get(cue.id) ?? createGlyph(cue), pose = cue.anchor === 'stage' ? null : poses[cue.anchor];
          g.mesh.visible = true;
          if (g.mode === 'free') { if (cue.anchor !== 'stage' && !pose) g.mesh.visible = false; else g.mesh.position.copy(cue.anchor === 'stage' ? new Vector3(...actorPoint([cue.offset[0], 1.8 + cue.offset[1], cue.offset[2]])) : room.point(cue.anchor).add(new Vector3(-cue.offset[0], cue.offset[1], -cue.offset[2]))); }
          if (g.mode === 'held') {
            for (const id of g.holders) if (!hands.has(id)) { g.holders.delete(id); held.delete(id); g.stretch = null; emitInteraction(g, 'release'); }
            const points = [...g.holders].flatMap(h => hands.has(h) ? [hands.get(h)!] : []); if (points.length) { const p = points.reduce((sum, v) => sum.add(v), new Vector3()).multiplyScalar(1 / points.length); if (g.lastTime && now > g.lastTime) g.velocity = releaseVelocity(g.last, xyz(p), now - g.lastTime); g.last = xyz(p); g.lastTime = now; g.mesh.position.copy(p); }
            if (!points.length) g.mode = 'free';
            if (points.length === 2 && g.stretch) { const next = stretchScale(g.stretch.scale, g.stretch.distance, points[0].distanceTo(points[1])); if (Math.abs(next - g.scale) > .05) { g.scale = next; emitInteraction(g, 'stretch'); } }
          }
          if (g.mode === 'attached' && head) g.mesh.position.fromArray(head.position).add(new Vector3(0, -.35, -.3).applyQuaternion(new Quaternion(...head.orientation)));
          if (g.mode === 'flight' && g.flight) { g.flight = advanceFlight(g.flight, Math.min(.25, elapsed / 1000)); g.mesh.position.fromArray(g.flight.position); if (g.flight.landed) { progress(); const waiting = emitInteraction(g, 'land', g.flight.landed); g.mode = 'landed'; if (waiting) pause(); } }
          g.mesh.scale.setScalar(g.scale); g.mesh.lookAt(viewerPosition); if (g.presented !== g.mesh.visible) { g.presented = g.mesh.visible; emitInteraction(g, g.presented ? 'show' : 'hide'); }
        }
        if (transport.phase !== 'playing') { renderer.render(scene, camera); return; }
        if (now - lastSample >= 100) { lastSample = now; samples.push({ elapsedMs: now - epoch, mediaMs: ms, head, actorHead: poses.head ? xyz(room.point('head')) : null, source: renderer.xr.isPresenting ? 'xr' : 'desktop' }); }
        if (ms - lastProgress >= 1000) { lastProgress = ms; progress(); }
        previousMs = ms;
        if (ms >= loaded.clip.take.durationMs) { transport = { phase: 'ended', offsetMs: loaded.clip.take.durationMs, anchorS: audio.time() }; audio.pause(); progress(true); message = '片段播放完成，记录已提交。'; publish(); }
      }
    }
    renderer.render(scene, camera); if (now - lastPublish >= 250) { lastPublish = now; publish(); }
  }
  const observer = new ResizeObserver(() => resize());
  function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); }
  function view(index = PREVIEW_SEAT) { const seat = room.seats[index]; if (!seat) throw new Error('座位编号无效。'); currentSeat = index; room.view(index); rig.rotation.set(0, 0, 0); rig.position.fromArray(seat.position); camera.position.set(0, 1.2, 0); camera.lookAt(0, 1.7, -3.78); }
  const hidden = () => { if (document.hidden) safePause('网页进入后台。'); }, contextLost = (event: Event) => { event.preventDefault(); safePause('画面资源丢失，请重新加载。'); lost = true; ready = false; renderer.setAnimationLoop(null); publish(); };
  const xrVisibility = () => { if (xr?.visibilityState !== 'visible') safePause('头显被系统界面遮挡。'); }, xrEnd = () => { xr?.removeEventListener('visibilitychange', xrVisibility); xr = null; if (xrCounted) xrExits++; xrCounted = false; xrAligned = false; void Promise.resolve().then(() => { if (!disposed) { view(currentSeat); publish(); } }); inputTracking = { left: false, right: false }; controllers.forEach(c => { c.visible = false; }); hands.clear(); safePause('已退出 VR。'); };
  async function enterVR() { if (!navigator.xr || xr || xrPending || lost) throw new Error('此时无法进入 VR。'); xrPending = true; let pending: XRSession | null = null; try { pending = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }); if (disposed) { await pending.end(); return; } xr = pending; xrAligned = false; xrCounted = false; looking = null; for (const g of new Set(held.values())) { g.holders.clear(); g.mode = 'free'; g.stretch = null; g.lastTime = 0; } held.clear(); hands.clear(); xr.addEventListener('end', xrEnd, { once: true }); xr.addEventListener('visibilitychange', xrVisibility); await renderer.xr.setSession(xr); if (xr !== pending || disposed) throw new Error('进入 VR 已取消，请重试。'); xrCounted = true; xrEntries++; publish(); } catch (e) { await pending?.end().catch(() => {}); throw e; } finally { xrPending = false; } }
  function clear() { pause(); generation++; for (const list of cache.values()) for (const g of list.values()) destroy(g); cache.clear(); glyphs = new Map(); loaded = null; ready = false; transport = { ...INITIAL_TRANSPORT }; publish(); }
  function dispose() { if (disposed) return; disposed = true; generation++; audio.dispose(); renderer.setAnimationLoop(null); observer.disconnect(); document.removeEventListener('visibilitychange', hidden); renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', pointerUp); renderer.domElement.removeEventListener('contextmenu', contextMenu); renderer.domElement.removeEventListener('wheel', wheel); renderer.domElement.removeEventListener('keydown', keyboard); for (const { controller, start, end, squeeze } of controllerListeners) { controller.removeEventListener('selectstart', start); controller.removeEventListener('selectend', end); controller.removeEventListener('squeezestart', squeeze); } if (xr) { xr.removeEventListener('end', xrEnd); xr.removeEventListener('visibilitychange', xrVisibility); void xr.end().catch(() => {}); } for (const list of cache.values()) for (const g of list.values()) destroy(g); cache.clear(); panel.dispose(); lineGeometry.dispose(); lineMaterial.dispose(); room.dispose(); captionTextures.forEach(t => t.dispose()); captionTextures.clear(); if (chineseFont) document.fonts.delete(chineseFont); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); }
  renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointermove', pointerMove); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', pointerUp); renderer.domElement.addEventListener('contextmenu', contextMenu); renderer.domElement.addEventListener('wheel', wheel, { passive: false }); renderer.domElement.addEventListener('keydown', keyboard); renderer.domElement.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', hidden); observer.observe(host); view(); resize(); renderer.setAnimationLoop(tick);
  return { load, play, estimateArms: (enabled: boolean) => { if (loaded?.clip.take.source !== 'test-fixture') throw new Error('估算手臂开关仅用于工程测试素材。'); estimatedArms = enabled; }, pause: (offset?: number) => pause(false, offset), clear, grabCaption, release: () => release('mouse'), scaleCaption: (factor: number) => { const g = held.get('mouse'); if (g) { g.scale = stretchScale(g.scale, 1, factor); emitInteraction(g, 'stretch'); } }, panel: (data: ScenePanel | null) => { panelLower = data?.placement === 'lower'; panel.update(data); }, resetView: () => { if (!renderer.xr.isPresenting) view(); }, attach, throwToStage: () => release('mouse', true), enterVR, exitVR: () => xr?.end(), view, dispose };
}
