import { BoxGeometry, CanvasTexture, Color, GridHelper, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, WebGLRenderer } from 'three';
import type { RecorderAudio, CaptureAudioResult } from '../core/audio-interface';
import { base64Bytes, hasRecordingFrameGap, makeCalibration, MAX_RECORDING_FRAME_GAP_MS, pcmWave, RECORDING_SECONDS, validateRecording, type Calibration, type CapturedFrame, type CapturedPose, type InputDevice, type RecordedTake } from '../core/recording';
export type RecorderState = { phase: 'idle' | 'preparing' | 'ready' | 'recording' | 'stopping' | 'captured' | 'error'; inVR: boolean; calibrated: boolean; microphoneActive: boolean; elapsedMs: number; frames: number; message: string; take: RecordedTake | null };
export const EMPTY_RECORDER: RecorderState = { phase: 'idle', inVR: false, calibrated: false, microphoneActive: false, elapsedMs: 0, frames: 0, message: '准备麦克风后进入 VR 校准。', take: null };
export function createRecorder(host: HTMLElement, audio: RecorderAudio, changed: (state: RecorderState) => void) {
  const renderer = new WebGLRenderer({ antialias: true }); renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  const scene = new Scene(); scene.background = new Color('#e7eee7'); const camera = new PerspectiveCamera(50, 1, .1, 40);
  camera.position.set(0, 1.7, 3); camera.lookAt(0, 1.2, 0);
  const grid = new GridHelper(8, 16), shapes = [new BoxGeometry(.2, .25, .2), new SphereGeometry(.07, 12, 10), new PlaneGeometry(2.3, .9)];
  const materials = [new MeshStandardMaterial({ color: '#438ebc' }), new MeshStandardMaterial({ color: '#c68a29' })];
  const hands = [new Mesh(shapes[1], materials[0]), new Mesh(shapes[1], materials[1])]; hands.forEach(h => { h.visible = false; scene.add(h); }); scene.add(grid, new HemisphereLight('#ffffff', '#73847b', 3));
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 400; const painter = canvas.getContext('2d'); if (!painter) throw new Error('无法创建提示画面。');
  const texture = new CanvasTexture(canvas), panelMaterial = new MeshBasicMaterial({ map: texture }), panel = new Mesh(shapes[2], panelMaterial); panel.visible = false; scene.add(panel);
  let state = { ...EMPTY_RECORDER }, disposed = false, generation = 0, lastPublish = 0, lastText = '', needsPrompt = true;
  let session: XRSession | undefined, pending: Promise<void> | undefined, reference: XRReferenceSpace | undefined, calibration: Calibration | undefined, captureCalibration: Calibration | undefined, latest: CapturedPose | null = null;
  let frames: CapturedFrame[] = [], events: RecordedTake['events'] = [], devices: InputDevice[] = [], origin = 0;
  const sources = new Map<XRInputSource, string>();
  function publish(patch: Partial<RecorderState> = {}, force = true) {
    if (disposed) return; state = { ...state, ...patch, inVR: Boolean(session), calibrated: Boolean(calibration), microphoneActive: audio.info().active };
    if (!force && performance.now() - lastPublish < 150) return; lastPublish = performance.now(); changed(state);
    const instruction = state.phase === 'error' ? '本轮未完成，扣扳机退出' : state.phase === 'recording' ? '录制中，扣扳机结束' : state.phase === 'stopping' ? '正在收齐声音，请稍候' : state.phase === 'captured' ? '已结束，扣扳机退出后保存' : calibration ? '已校准，再扣扳机开始' : '平视前方，扣扳机校准';
    const text = instruction + state.elapsedMs.toFixed(0); if (text === lastText) return; lastText = text;
    painter!.fillStyle = '#163c32'; painter!.fillRect(0, 0, 1024, 400); painter!.fillStyle = '#f2f6ed'; painter!.font = '44px sans-serif'; painter!.fillText('演员动作与声音录制', 40, 70); painter!.font = '36px sans-serif'; painter!.fillText(instruction, 40, 160); painter!.fillText(`${(state.elapsedMs / 1000).toFixed(1)} / ${RECORDING_SECONDS} 秒`, 40, 245); painter!.font = '27px sans-serif'; painter!.fillText('本机保存；缺失与估算位置如实保留', 40, 325); texture.needsUpdate = true;
  }
  function fail(message: string) { generation++; audio.release(); publish({ phase: 'error', message }); }
  function event(type: string, detail: string) { events.push({ tMs: Math.max(0, (audio.info().timeS - origin) * 1000), type, detail }); }
  function finish(result: CaptureAudioResult) {
    if (disposed || !captureCalibration) return;
    const durationMs = result.samples.length / result.info.sampleRate * 1000, kept = frames.filter(f => f.tMs <= durationMs), gap = hasRecordingFrameGap(kept, durationMs);
    const interrupted = result.interrupted || gap, stopReason = gap && !result.interrupted ? 'xr-frame-gap' : result.stopReason;
    const keptEvents = events.filter(e => e.tMs <= durationMs); keptEvents.push({ tMs: durationMs, type: result.finalization === 'buffered-prefix' ? 'buffered-prefix' : 'capture-end', detail: result.audioStopReason });
    if (gap) keptEvents.push({ tMs: durationMs, type: 'tracking-coverage-gap', detail: 'Long pose coverage gap' });
    try {
      const take = validateRecording({ schema: 'punchcap-take-v1', source: 'device-capture', id: crypto.randomUUID(), createdAt: new Date().toISOString(), browser: navigator.userAgent,
        referenceSpace: 'local-floor', coordinates: 'right-handed-y-up-metres', calibration: captureCalibration, durationMs, captureLimitMs: RECORDING_SECONDS * 1000, frames: kept, devices, events: keptEvents, interrupted, stopReason,
        audio: { clock: 'audio-context-pcm-frames', sampleRate: result.info.sampleRate, frames: result.samples.length, startContextFrame: result.startFrame, wavBase64: base64Bytes(pcmWave(result.samples, result.info.sampleRate)), baseLatencySeconds: result.info.baseLatencySeconds, processing: result.info.processing } });
      publish({ phase: 'captured', take, elapsedMs: durationMs, frames: kept.length, microphoneActive: false, message: interrupted ? '本轮有中断，请先下载复查；不能作为正式实验素材。' : '录制结束。请退出 VR，下载原件并在素材库审核。' });
    } catch { fail('未形成足够的有效声音与动作，不能保存为完整片段。'); }
    queueMicrotask(() => publish());
  }
  async function prepare() {
    if (session || ['recording', 'stopping', 'preparing'].includes(state.phase)) return; const id = ++generation; audio.release();
    frames = []; events = []; devices = []; sources.clear(); calibration = undefined; captureCalibration = undefined; latest = null; needsPrompt = true; hands.forEach(h => h.visible = false);
    publish({ ...EMPTY_RECORDER, phase: 'preparing', message: '请亲自确认麦克风权限；声音只在本机处理。' });
    try { await audio.prepare(reason => fail(`录制准备中断：${reason}；请重新准备。`)); if (!disposed && generation === id) publish({ phase: 'ready', message: '进入 VR 后先校准，再开始录制。' }); }
    catch (error) { if (!disposed && generation === id) fail(error instanceof Error ? error.message : '麦克风准备失败。'); }
  }
  function cancel() { if (session) return; generation++; audio.release(); calibration = undefined; publish({ phase: 'idle', message: '已取消，麦克风已关闭。' }); }
  function place(c: Calibration) { panel.position.set(c.origin[0] - Math.sin(c.yaw) * 2, c.headHeight, c.origin[2] - Math.cos(c.yaw) * 2); panel.rotation.y = c.yaw; }
  function select() {
    if (state.phase === 'captured' || state.phase === 'error') { void session?.end(); return; }
    if (state.phase === 'recording') { audio.stop('user', false); return; }
    if (state.phase !== 'ready' || !latest) return;
    if (!calibration) { try { calibration = makeCalibration(latest); place(calibration); publish(); } catch { publish({ message: '请平视前方后重新校准。' }); } return; }
    captureCalibration = calibration; frames = []; events = [];
    try {
      const startFrame = audio.start((reason, abnormal) => { event(abnormal ? 'interrupted' : 'stop', reason); publish({ phase: 'stopping', message: '正在保留连续声音采样，结束后请下载。' }); }, finish);
      origin = startFrame / audio.info().sampleRate; publish({ phase: 'recording', elapsedMs: 0, frames: 0, message: '正在录制；扣扳机结束。' });
    } catch (error) { fail(error instanceof Error ? error.message : '无法开始录制。'); }
  }
  function unavailable(reason: string) { if (['recording', 'stopping'].includes(state.phase)) audio.stop(reason, true); else if (state.phase === 'ready') fail('准备被打断，请退出 VR 后重新准备。'); }
  function visibility() { if (session?.visibilityState !== 'visible') unavailable(`xr-${session?.visibilityState}`); }
  function reset() { unavailable('reference-space-reset'); calibration = undefined; publish(); }
  function inputs() { session?.inputSources.forEach(register); if (state.phase === 'recording') event('inputs-change', 'Input source list changed'); }
  function register(source: XRInputSource) { let id = sources.get(source); if (!id) { id = `input-${sources.size + 1}`; sources.set(source, id); devices.push({ id, handedness: source.handedness, kind: source.hand ? 'hand' : 'controller', profiles: [...source.profiles] }); } return id; }
  function end() {
    const ready = state.phase === 'ready'; unavailable('xr-session-ended');
    session?.removeEventListener('select', select); session?.removeEventListener('visibilitychange', visibility); session?.removeEventListener('inputsourceschange', inputs); reference?.removeEventListener('reset', reset);
    session = undefined; reference = undefined; calibration = undefined; latest = null; panel.visible = false;
    if (ready) cancel(); camera.position.set(0, 1.7, 3); camera.lookAt(0, 1.2, 0); resize(); publish();
  }
  function enter(): Promise<void> {
    if (pending) return pending; if (!navigator.xr || state.phase !== 'ready') return Promise.reject(new Error('请在头显准备后进入 VR。'));
    const id = generation, request = navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    pending = (async () => { const s = await request; if (disposed || id !== generation) { await s.end(); return; } session = s;
      s.addEventListener('end', end, { once: true }); s.addEventListener('select', select); s.addEventListener('visibilitychange', visibility); s.addEventListener('inputsourceschange', inputs);
      try { const r = await s.requestReferenceSpace('local-floor'); if (disposed || session !== s) { await s.end(); return; } reference = r; reference.addEventListener('reset', reset); needsPrompt = true; inputs(); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); await renderer.xr.setSession(s); if (disposed) await s.end(); else publish(); }
      catch (error) { await s.end().catch(() => {}); throw error; }
    })().finally(() => { pending = undefined; }); return pending;
  }
  function pose(p: XRPose | null | undefined): CapturedPose | null { if (!p) return null; const v = p.transform.position, q = p.transform.orientation; return { position: [v.x, v.y, v.z], orientation: [q.x, q.y, q.z, q.w], emulatedPosition: p.emulatedPosition }; }
  function tick(predicted: number, frame?: XRFrame) {
    if (disposed) return;
    try {
      if (session && reference && frame) {
        panel.visible = true; latest = pose(frame.getViewerPose(reference));
        if (needsPrompt && latest) { try { place(makeCalibration(latest)); needsPrompt = false; } catch { /* Wait for a horizontal view. */ } }
        const hand = (side: 'left' | 'right', index: number) => { const candidates = [...session!.inputSources].filter(s => s.handedness === side); let p: CapturedPose | null = null, source: string | null = null;
          if (candidates.length === 1) { const input = candidates[0], space = input.gripSpace ?? input.hand?.get('wrist'); source = register(input); if (space) p = pose(frame.getPose(space, reference!)); }
          const mesh = hands[index]; mesh.visible = Boolean(p); if (p) { mesh.position.set(...p.position); mesh.quaternion.set(...p.orientation); } return { p, source }; };
        const l = hand('left', 0), r = hand('right', 1);
        if (state.phase === 'recording') {
          const tMs = (audio.info().timeS - origin) * 1000;
          if (tMs >= 0 && tMs <= RECORDING_SECONDS * 1000 && (!frames.length || tMs > frames.at(-1)!.tMs)) {
            if (frames.length && tMs - frames.at(-1)!.tMs > MAX_RECORDING_FRAME_GAP_MS) unavailable('xr-frame-gap');
            else frames.push({ tMs, predictedDisplayTimeMs: predicted, observedPerformanceTimeMs: performance.now(), head: latest, leftHand: l.p, rightHand: r.p, leftSource: l.source, rightSource: r.source });
          }
          publish({ elapsedMs: Math.max(0, tMs), frames: frames.length }, false);
        }
      }
      renderer.render(scene, camera);
    } catch { unavailable('render-failure'); }
  }
  function pageVisibility() { if (document.hidden && session?.visibilityState !== 'visible') { if (session) unavailable('page-hidden'); else if (['ready', 'preparing'].includes(state.phase)) cancel(); } }
  function resize() { if (session || disposed) return; renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize);
  function contextLost(e: Event) { e.preventDefault(); renderer.setAnimationLoop(null); if (['recording', 'stopping'].includes(state.phase)) unavailable('webgl-context-lost'); else fail('画面中断，请保存原件后刷新。'); }
  function dispose() {
    if (disposed) return; disposed = true; generation++; audio.release(); observer.disconnect(); document.removeEventListener('visibilitychange', pageVisibility); renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.setAnimationLoop(null);
    const active = session; session = undefined; active?.removeEventListener('end', end); active?.removeEventListener('select', select); active?.removeEventListener('visibilitychange', visibility); active?.removeEventListener('inputsourceschange', inputs); reference?.removeEventListener('reset', reset);
    const release = () => { shapes.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); texture.dispose(); panelMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
    if (active || pending) void (pending ?? Promise.resolve()).catch(() => {}).then(() => active?.end()).catch(() => {}).finally(release); else release();
  }
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; renderer.domElement.setAttribute('aria-label', '演员录制画面');
  renderer.domElement.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', pageVisibility); observer.observe(host); resize(); renderer.setAnimationLoop(tick); publish();
  return { prepare, cancel, enter, exit: async () => { await session?.end(); }, dispose };
}
