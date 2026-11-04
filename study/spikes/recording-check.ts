import { BoxGeometry, CanvasTexture, Color, GridHelper, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { base64Bytes, hasRecordingFrameGap, makeCalibration, MAX_RECORDING_FRAME_GAP_MS, pcmWave, RECORDING_SECONDS, sampleRecording, validateRecording, waveBytes, type Calibration, type CapturedFrame, type CapturedPose, type InputDevice, type RecordedTake } from './recording-rules';
import { INITIAL_TRANSPORT, pauseStalledTransport, pauseTransport, startTransport, transportTime, type Pose, type Transport } from './replay-rules';
import { createPcmCapture, type CaptureResult } from './recording-capture';

type Phase = 'idle' | 'preparing' | 'ready' | 'recording' | 'stopping' | 'captured' | 'playing' | 'paused' | 'error';
export type RecordingState = {
  phase: Phase; message: string; inVR: boolean; calibrated: boolean; microphoneActive: boolean; elapsedMs: number; frames: number;
  summary: { source: RecordedTake['source']; durationMs: number; frames: number; head: number; left: number; right: number; estimated: number; interrupted: boolean; rms: number; stopReason: string; bufferedPrefix: boolean } | null;
};
export const INITIAL_RECORDING: RecordingState = { phase: 'idle', message: '先准备麦克风，再进入 VR 校准和录制。', inVR: false, calibrated: false, microphoneActive: false, elapsedMs: 0, frames: 0, summary: null };
export type RecordingCheck = {
  prepare: () => Promise<void>; cancelPreparation: () => void; enterVR: () => Promise<void>; exitVR: () => Promise<void>;
  calibrate: () => void; start: () => void; stop: () => void; play: () => Promise<void>; pause: () => void;
  setView: (side: 'front' | 'left' | 'right') => void; importTake: (value: unknown) => void;
  take: () => RecordedTake | null; dispose: () => void;
};

/** This standalone spike records locally. It never sends microphone or pose data. */
export function createRecordingCheck(host: HTMLElement, onChange: (state: RecordingState) => void): RecordingCheck {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  const scene = new Scene(); scene.background = new Color('#e7eee7');
  const camera = new PerspectiveCamera(50, 1, 0.1, 40);
  const geometries = [new BoxGeometry(.28, .32, .26), new SphereGeometry(.07, 12, 10), new PlaneGeometry(2.2, .9)];
  const materials = [new MeshStandardMaterial({ color: '#33775f' }), new MeshStandardMaterial({ color: '#438ebc' }), new MeshStandardMaterial({ color: '#c68a29' })];
  const points = { head: new Mesh(geometries[0], materials[0]), leftHand: new Mesh(geometries[1], materials[1]), rightHand: new Mesh(geometries[1], materials[2]) };
  Object.values(points).forEach(point => { point.visible = false; scene.add(point); });
  const grid = new GridHelper(8, 16, '#8caa99', '#cbd8cf'); scene.add(grid, new HemisphereLight('#ffffff', '#73847b', 3));
  const panelCanvas = document.createElement('canvas'); panelCanvas.width = 1024; panelCanvas.height = 420;
  const painter = panelCanvas.getContext('2d'); if (!painter) { renderer.dispose(); throw new Error('Canvas unavailable'); }
  const texture = new CanvasTexture(panelCanvas), panelMaterial = new MeshBasicMaterial({ map: texture });
  const panel = new Mesh(geometries[2], panelMaterial); panel.position.set(0, 1.55, -2); scene.add(panel);
  let state = { ...INITIAL_RECORDING }, disposed = false, generation = 0, publishedAt = 0, panelText = '', placePrompt = true;
  let session: XRSession | undefined, pendingVR: Promise<void> | undefined, reference: XRReferenceSpace | undefined, calibration: Calibration | undefined, captureCalibration: Calibration | undefined, latestHead: CapturedPose | null = null;
  let context: AudioContext | undefined, stream: MediaStream | undefined, input: MediaStreamAudioSourceNode | undefined, worklet: AudioWorkletNode | undefined, mute: GainNode | undefined;
  let take: RecordedTake | null = null, frames: CapturedFrame[] = [], events: RecordedTake['events'] = [], devices: InputDevice[] = [];
  const sourceIds = new Map<XRInputSource, string>();
  let startFrame = 0, capture: ReturnType<typeof createPcmCapture> | undefined, processing: RecordedTake['audio']['processing'] = { echoCancellation: null, noiseSuppression: null, autoGainControl: null };
  let transport: Transport = { ...INITIAL_TRANSPORT }, source: AudioBufferSourceNode | undefined, decoded: AudioBuffer | undefined, previousReplayMs = 0;

  function publish(patch: Partial<RecordingState> = {}, force = true) {
    if (disposed) return;
    state = { ...state, ...patch, inVR: Boolean(session), calibrated: Boolean(calibration), microphoneActive: stream?.getAudioTracks().some(track => track.readyState === 'live') ?? false };
    const now = performance.now(); if (!force && now - publishedAt < 150) return;
    publishedAt = now; onChange(state);
    const instruction = state.phase === 'error' ? '本轮未完成：扣扳机退出，查看提示'
      : state.phase === 'stopping' ? '正在收齐声音，请稍候…'
      : state.phase === 'recording' ? '录制中：15 秒自动结束'
      : state.phase === 'captured' ? state.summary?.interrupted ? '本轮有中断：扣扳机退出后下载复查' : '录制结束：扣扳机退出 VR，下载文件'
      : !calibration ? '平视前方，扣一次扳机校准'
      : '已校准，再扣一次扳机开始录制';
    const text = `${instruction}|${state.elapsedMs.toFixed(0)}|${state.phase}`;
    if (text !== panelText) {
      panelText = text; painter!.fillStyle = '#163c32'; painter!.fillRect(0, 0, 1024, 420);
      painter!.fillStyle = '#f2f6ed'; painter!.font = '42px sans-serif'; painter!.fillText('真实头部、双手与声音检查', 36, 72);
      painter!.font = '34px sans-serif'; painter!.fillText(instruction, 36, 160);
      painter!.fillText(`${(state.elapsedMs / 1000).toFixed(1)} 秒 / 最多 ${RECORDING_SECONDS} 秒`, 36, 238);
      painter!.font = '26px sans-serif'; painter!.fillText('只保存在本机；缺失追踪会如实记录', 36, 318); texture.needsUpdate = true;
    }
  }
  function event(type: string, detail = '') {
    if (!context || !['recording', 'stopping'].includes(state.phase)) return;
    events.push({ tMs: Math.max(0, (context.currentTime - startFrame / context.sampleRate) * 1000), type, detail: detail.slice(0, 200) });
  }
  function stopTracks() { stream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.stop(); }); }
  function releaseMic() {
    capture?.cancel(); capture = undefined; stopTracks(); stream = undefined;
    input?.disconnect(); input = undefined;
    if (worklet) { worklet.onprocessorerror = null; worklet.port.onmessage = null; worklet.port.close(); worklet.disconnect(); worklet = undefined; }
    mute?.disconnect(); mute = undefined;
  }
  function stopSource() { if (source) { source.stop(); source.disconnect(); source = undefined; } }
  function cancelPreparation() {
    if (session || !['ready', 'preparing'].includes(state.phase)) return;
    generation++; releaseMic(); calibration = undefined;
    if (context) { context.onstatechange = null; void context.close().catch(() => {}); context = undefined; }
    publish({ phase: 'idle', message: '已取消准备并关闭麦克风。' });
  }
  function position() { return take ? transportTime(transport, context?.currentTime ?? 0, take.durationMs) : 0; }
  function pause() {
    if (transport.phase !== 'playing' || !take) return;
    transport = pauseTransport(transport, context?.currentTime ?? 0, take.durationMs); stopSource();
    publish({ phase: 'paused', elapsedMs: position(), message: '已暂停。切换观察角度不会改变进度。' });
  }
  function fail(message: string) {
    generation++; releaseMic(); stopSource();
    if (context) { context.onstatechange = null; void context.close().catch(() => {}); context = undefined; }
    publish({ phase: 'error', message });
  }
  function stop(reason = 'user', abnormal = false) {
    if (['recording', 'stopping'].includes(state.phase)) capture?.stop(reason, abnormal);
  }
  function summarize(value: RecordedTake, samples?: Float32Array) {
    const wave = waveBytes(value), view = new DataView(wave.buffer);
    let energy = 0; for (let i = 0; i < value.audio.frames; i++) { const v = samples ? samples[i] : view.getInt16(44 + i * 2, true) / 32768; energy += v * v; }
    return { source: value.source, durationMs: value.durationMs, frames: value.frames.length, head: value.frames.filter(f => f.head).length,
      left: value.frames.filter(f => f.leftHand).length, right: value.frames.filter(f => f.rightHand).length,
      estimated: value.frames.filter(f => [f.head, f.leftHand, f.rightHand].some(p => p?.emulatedPosition)).length,
      interrupted: value.interrupted, rms: Math.sqrt(energy / value.audio.frames), stopReason: value.stopReason,
      bufferedPrefix: value.events.some(e => e.type === 'buffered-prefix') };
  }
  function finishAudio(data: CaptureResult) {
    if (!context || !captureCalibration || !['recording', 'stopping'].includes(state.phase)) return;
    const samples = data.samples, durationMs = samples.length / context.sampleRate * 1000;
    const capturedFrames = frames.filter(f => f.tMs <= durationMs), trackingGap = hasRecordingFrameGap(capturedFrames, durationMs);
    const interrupted = data.interrupted || trackingGap, stopReason = trackingGap && !data.interrupted ? 'xr-frame-gap' : data.stopReason;
    const captureEvents = events.filter(e => e.tMs <= durationMs);
    if (trackingGap) captureEvents.push({ tMs: durationMs, type: 'tracking-coverage-gap', detail: 'Pose samples do not cover the audio without a long gap.' });
    captureEvents.push({ tMs: durationMs, type: data.finalization === 'buffered-prefix' ? 'buffered-prefix' : 'capture-end', detail: data.audioStopReason });
    const candidate: RecordedTake = {
      schema: 'punchcap-recording-check-v1', source: 'device-capture', id: crypto.randomUUID(), createdAt: new Date().toISOString(), browser: navigator.userAgent,
      referenceSpace: 'local-floor', coordinates: 'right-handed-y-up-metres', durationMs, calibration: captureCalibration,
      frames: capturedFrames, devices: [...devices], interrupted, stopReason,
      events: captureEvents,
      audio: { clock: 'audio-context-pcm-frames', sampleRate: context.sampleRate, frames: samples.length, startContextFrame: startFrame,
        wavBase64: base64Bytes(pcmWave(samples, context.sampleRate)), baseLatencySeconds: context.baseLatency ?? null, processing },
    };
    generation++; releaseMic(); decoded = undefined; transport = { ...INITIAL_TRANSPORT };
    try {
      take = validateRecording(candidate);
      publish({ phase: 'captured', elapsedMs: durationMs, frames: take.frames.length, summary: summarize(take, samples),
        message: interrupted ? '本轮有中断，已保留有效片段并关闭麦克风。退出 VR 后下载复查；下轮需重新准备和校准。' : '本轮已录制，麦克风已关闭。退出 VR 后先下载，再试听和读取文件回放。' });
    } catch { fail('片段过短或动作/声音不完整，没有生成可回放文件。请重新准备。'); }
  }
  async function prepare() {
    if (disposed || session || ['preparing', 'recording', 'stopping', 'playing'].includes(state.phase)) return;
    const id = ++generation; releaseMic(); stopSource();
    const old = context; context = undefined; if (old) { old.onstatechange = null; void old.close().catch(() => {}); }
    calibration = undefined; captureCalibration = undefined; latestHead = null; placePrompt = true;
    sourceIds.clear(); devices = []; decoded = undefined; take = null;
    show({ head: null, leftHand: null, rightHand: null });
    publish({ ...INITIAL_RECORDING, phase: 'preparing', message: '请按浏览器提示允许麦克风。声音只保存在本页。' });
    let pendingStream: MediaStream | undefined, pendingContext: AudioContext | undefined;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error('当前浏览器缺少安全环境或录音接口。');
      // Permission is requested by this explicit button; never by page load.
      pendingContext = new AudioContext({ latencyHint: 'interactive' }); context = pendingContext;
      const resumed = pendingContext.resume();
      const microphone = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false }).then(value => {
        if (disposed || generation !== id) { value.getTracks().forEach(track => track.stop()); throw new Error('准备已取消。'); }
        pendingStream = value; return value;
      });
      [pendingStream] = await Promise.all([microphone, resumed]);
      await pendingContext.audioWorklet.addModule('/study/checks/recording/pcm-capture.js');
      if (disposed || generation !== id) { pendingStream.getTracks().forEach(t => t.stop()); await pendingContext.close().catch(() => {}); return; }
      context = pendingContext; stream = pendingStream;
      const microphoneTrack = stream.getAudioTracks()[0];
      if (!microphoneTrack || microphoneTrack.readyState !== 'live' || microphoneTrack.muted || context.state !== 'running') throw new Error('声音输入未能保持可用，请重新准备麦克风。');
      const settings = microphoneTrack.getSettings();
      processing = { echoCancellation: typeof settings.echoCancellation === 'boolean' ? settings.echoCancellation : null, noiseSuppression: settings.noiseSuppression ?? null, autoGainControl: settings.autoGainControl ?? null };
      input = context.createMediaStreamSource(stream); worklet = new AudioWorkletNode(context, 'recording-pcm'); mute = context.createGain(); mute.gain.value = 0;
      input.connect(worklet).connect(mute).connect(context.destination);
      worklet.port.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!disposed && generation === id) capture?.receive(data);
      };
      worklet.onprocessorerror = () => { if (!disposed && generation === id) { if (capture) capture.invalid('worklet-error'); else fail('声音线程发生错误，请重新准备麦克风。'); } };
      stream.getTracks().forEach(track => { track.onended = () => unavailable('microphone-ended'); track.onmute = () => unavailable('microphone-muted'); });
      context.onstatechange = () => { if (context?.state !== 'running') { unavailable('audio-context-interrupted'); pause(); } };
      publish({ phase: 'ready', message: '麦克风已准备。进入 VR 后，平视前方，先扣一次扳机校准，再扣一次开始。' });
    } catch (error) {
      pendingStream?.getTracks().forEach(t => t.stop()); if (pendingContext && pendingContext !== context) void pendingContext.close().catch(() => {});
      if (!disposed && generation === id) fail(error instanceof DOMException && error.name === 'NotAllowedError' ? '麦克风未获允许。可以重新准备，由你确认浏览器提示。' : error instanceof Error ? error.message : '录音准备失败。');
    }
  }
  function unavailable(reason: string) {
    if (state.phase === 'ready') fail('录制准备已中断，麦克风已关闭。请退出 VR 后重新准备和校准。');
    else stop(reason, true);
  }
  function register(source: XRInputSource): string {
    let id = sourceIds.get(source);
    if (!id) { id = `input-${sourceIds.size + 1}`; sourceIds.set(source, id); devices.push({ id, handedness: source.handedness, kind: source.hand ? 'hand' : 'controller', profiles: [...source.profiles] }); }
    return id;
  }
  function pose(value: XRPose | null | undefined): CapturedPose | null {
    if (!value) return null;
    const p = value.transform.position, q = value.transform.orientation;
    return { position: [p.x, p.y, p.z], orientation: [q.x, q.y, q.z, q.w], emulatedPosition: value.emulatedPosition };
  }
  function calibrate() {
    if (!session || state.phase !== 'ready') return;
    if (!latestHead) { publish({ message: '当前没有有效头部追踪，请检查头显定位后再校准。' }); return; }
    try {
      calibration = makeCalibration(latestHead);
      placePanel(calibration);
      publish({ message: '已记录地面、原点、正前方和头部高度。再次扣扳机开始录制。' });
    } catch (error) { publish({ message: error instanceof Error ? error.message : '校准失败。' }); }
  }
  function placePanel(c: Calibration) {
    panel.position.set(c.origin[0] - Math.sin(c.yaw) * 2, c.headHeight, c.origin[2] - Math.cos(c.yaw) * 2); panel.rotation.y = c.yaw;
  }
  function start() {
    if (!session || !reference || !calibration || !context || !worklet || state.phase !== 'ready') return;
    if (context.state !== 'running') { fail('声音时钟已暂停，请退出 VR 后重新准备麦克风。'); return; }
    const microphone = stream?.getAudioTracks()[0];
    if (!microphone || microphone.readyState !== 'live' || microphone.muted) { fail('麦克风已暂停或结束，请退出 VR 后重新准备。'); return; }
    frames = []; events = [];
    captureCalibration = calibration;
    // A short scheduling lead gives both threads the same exact PCM origin.
    startFrame = Math.ceil((context.currentTime + .15) * context.sampleRate);
    capture = createPcmCapture({ sampleRate: context.sampleRate, startFrame,
      sendStop: () => { if (!worklet) throw new Error('Audio worklet disconnected'); worklet.port.postMessage({ type: 'stop' }); },
      onStopping: (reason, abnormal) => {
        event(abnormal ? 'interrupted' : 'stop', reason);
        if (abnormal) stopTracks();
        publish({ phase: 'stopping', message: '正在收齐声音采样；若声音线程没有回复，将保留已收到的有效前半段。' });
      }, onComplete: finishAudio });
    publish({ phase: 'recording', elapsedMs: 0, frames: 0, message: '正在录制头部、双手和声音；随时扣扳机停止，也会自动在 15 秒停止。' });
    worklet.port.postMessage({ type: 'start', startFrame, maxFrames: Math.floor(context.sampleRate * RECORDING_SECONDS) });
  }
  function selected() {
    if (state.phase === 'ready') { if (calibration) start(); else calibrate(); }
    else if (state.phase === 'recording') stop();
    else if (state.phase === 'captured' || state.phase === 'error') void exitVR();
  }
  function inputChanged() { session?.inputSources.forEach(register); event('inputs-change', 'Input source list changed; per-frame IDs are preserved.'); }
  function resetSpace() { stop('reference-space-reset', true); calibration = undefined; publish({ message: '参考空间重设，本轮已中断；下次必须重新校准。' }); }
  function xrVisibility() { if (session?.visibilityState !== 'visible') unavailable(`xr-${session?.visibilityState}`); }
  function pageVisibility() {
    // Immersive XR visibility is authoritative while the headset is rendering.
    if (!document.hidden || session?.visibilityState === 'visible') return;
    if (!session && ['ready', 'preparing'].includes(state.phase)) cancelPreparation();
    else unavailable('page-hidden');
    pause();
  }
  function sessionEnded() {
    const wasReady = state.phase === 'ready';
    stop('xr-session-ended', true);
    session?.removeEventListener('select', selected); session?.removeEventListener('inputsourceschange', inputChanged); session?.removeEventListener('visibilitychange', xrVisibility);
    reference?.removeEventListener('reset', resetSpace); session = undefined; reference = undefined; calibration = undefined; latestHead = null;
    if (wasReady) cancelPreparation();
    if (!disposed) queueMicrotask(() => { if (!disposed) { setView('front'); resize(); publish(); } });
  }
  function enterVR(): Promise<void> {
    if (pendingVR) return pendingVR;
    if (disposed || session || state.phase !== 'ready' || !navigator.xr) return Promise.resolve();
    const request = navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    pendingVR = (async () => {
    const current = await request;
    if (disposed) { await current.end(); return; }
    session = current; current.addEventListener('end', sessionEnded, { once: true });
    current.addEventListener('select', selected); current.addEventListener('inputsourceschange', inputChanged); current.addEventListener('visibilitychange', xrVisibility);
    try {
      const space = await current.requestReferenceSpace('local-floor');
      if (disposed || session !== current) { await current.end().catch(() => {}); return; }
      reference = space; placePrompt = true; reference.addEventListener('reset', resetSpace); inputChanged();
      camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); await renderer.xr.setSession(current);
      if (disposed || session !== current) { await current.end().catch(() => {}); return; }
      publish();
    } catch (error) { await current.end().catch(() => {}); throw error; }
    })().finally(() => { pendingVR = undefined; });
    return pendingVR;
  }
  async function exitVR() { if (session) await session.end(); }
  function setView(side: 'front' | 'left' | 'right') {
    if (session) return;
    panel.visible = false; camera.position.set(side === 'front' ? 0 : side === 'left' ? -3.5 : 3.5, 2.1, 4.3); camera.lookAt(0, 1.2, 0);
  }
  function importTake(value: unknown) {
    if (session || ['preparing', 'recording', 'stopping', 'playing'].includes(state.phase)) throw new Error('请先结束当前操作后再读取。');
    const checked = validateRecording(value); releaseMic(); stopSource(); take = checked; decoded = undefined; transport = { ...INITIAL_TRANSPORT };
    publish({ phase: 'captured', elapsedMs: 0, frames: checked.frames.length, summary: summarize(checked), message: '本机文件已校验并载入。可开始回放，声音负责播放进度。' });
  }
  async function play() {
    if (!take || session || ['preparing', 'playing', 'recording', 'stopping'].includes(state.phase)) return;
    const id = ++generation, currentTake = take;
    publish({ phase: 'preparing', message: '正在解码本机录音…' });
    try {
      if (!context || context.state === 'closed') context = new AudioContext();
      context.onstatechange = () => { if (context?.state !== 'running') pause(); };
      const audio = context; await audio.resume();
      if (!decoded) { const bytes = waveBytes(currentTake); decoded = await audio.decodeAudioData(bytes.slice().buffer as ArrayBuffer); }
      if (disposed || generation !== id || take !== currentTake) return;
      if (transport.phase === 'ended') transport = { ...INITIAL_TRANSPORT };
      const next = audio.createBufferSource(); next.buffer = decoded; next.connect(audio.destination);
      transport = startTransport(transport, audio.currentTime + .05, take.durationMs); previousReplayMs = transport.offsetMs;
      next.start(transport.anchorS, transport.offsetMs / 1000); source = next;
      publish({ phase: 'playing', message: take.source === 'test-fixture' ? '正在回放标注的测试文件；本轮不是设备采集。' : '正在回放真实录音与头部/双手测试点。' });
    } catch { if (!disposed && generation === id) fail('录音无法播放，请确认浏览器音频可用。'); }
  }
  function resize() { if (disposed || session) return; const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function show(poses: Record<'head' | 'leftHand' | 'rightHand', Pose | null>) {
    for (const joint of ['head', 'leftHand', 'rightHand'] as const) { const p = poses[joint], mesh = points[joint]; mesh.visible = Boolean(p); if (p) { mesh.position.set(...p.position); mesh.quaternion.set(...p.orientation); } }
  }
  function tick(predictedMs: number, xrFrame?: XRFrame) {
    if (disposed) return;
    try {
      if (session && reference && xrFrame) {
        panel.visible = true;
        latestHead = pose(xrFrame.getViewerPose(reference));
        if (placePrompt && latestHead && state.phase === 'ready') {
          // Place a fresh prompt ahead of this session without applying calibration early.
          try { placePanel(makeCalibration(latestHead)); placePrompt = false; } catch { /* Wait for a horizontal viewing direction. */ }
        }
        const hand = (side: 'left' | 'right') => {
          const matching = [...session!.inputSources].filter(input => input.handedness === side);
          if (matching.length !== 1) return { id: null, pose: null };
          const input = matching[0], id = register(input), space = input.gripSpace ?? input.hand?.get('wrist');
          return { id, pose: space ? pose(xrFrame.getPose(space, reference!)) : null };
        };
        const left = hand('left'), right = hand('right'); show({ head: null, leftHand: left.pose, rightHand: right.pose });
        if (state.phase === 'recording' && context) {
          const tMs = (context.currentTime - startFrame / context.sampleRate) * 1000;
          if (tMs >= 0 && tMs <= RECORDING_SECONDS * 1000 && (!frames.length || tMs > frames[frames.length - 1].tMs)) {
            if (frames.length && tMs - frames[frames.length - 1].tMs > MAX_RECORDING_FRAME_GAP_MS) stop('xr-frame-gap', true);
            else frames.push({ tMs, predictedDisplayTimeMs: predictedMs, observedPerformanceTimeMs: performance.now(), head: latestHead, leftHand: left.pose, rightHand: right.pose, leftSource: left.id, rightSource: right.id });
          }
          publish({ elapsedMs: Math.max(0, Math.min(RECORDING_SECONDS * 1000, tMs)), frames: frames.length }, false);
        }
      } else if (take) {
        if (state.phase === 'playing' && context) {
          const raw = transport.offsetMs + Math.max(0, context.currentTime - transport.anchorS) * 1000;
          const stalled = pauseStalledTransport(transport, previousReplayMs, raw, take.durationMs);
          if (stalled) { transport = stalled; stopSource(); publish({ phase: 'paused', message: '回放画面停顿，已保留最后可靠进度。请手动继续。' }); }
          else {
            previousReplayMs = raw;
            if (position() >= take.durationMs) { transport = { phase: 'ended', offsetMs: take.durationMs, anchorS: context.currentTime }; stopSource(); publish({ phase: 'captured', message: '真实片段回放已结束。请核对动作、声音与缺失记录。', elapsedMs: take.durationMs }); }
            else publish({ elapsedMs: position() }, false);
          }
        }
        show(sampleRecording(take, position()));
      }
      renderer.render(scene, camera);
    } catch { stop('render-failure', true); if (state.phase !== 'stopping') fail('画面无法继续，请下载已有文件后重新加载。'); }
  }
  const observer = new ResizeObserver(resize);
  function contextLost(e: Event) { e.preventDefault(); renderer.setAnimationLoop(null); if (state.phase === 'recording') stop('webgl-context-lost', true); else fail('三维画面已中断，请下载已有片段后刷新页面。'); }
  function dispose() {
    if (disposed) return; disposed = true; generation++;
    document.removeEventListener('visibilitychange', pageVisibility);
    observer.disconnect(); renderer.setAnimationLoop(null); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    releaseMic(); stopSource(); if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
    reference?.removeEventListener('reset', resetSpace);
    const active = session; session = undefined;
    active?.removeEventListener('end', sessionEnded); active?.removeEventListener('select', selected); active?.removeEventListener('inputsourceschange', inputChanged); active?.removeEventListener('visibilitychange', xrVisibility);
    renderer.domElement.remove();
    const release = () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose()); texture.dispose(); panelMaterial.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); };
    if (active || pendingVR) void (pendingVR ?? Promise.resolve()).catch(() => {}).then(() => active?.end()).catch(() => {}).finally(release); else release();
  }
  try {
    renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', '真实动作与声音录制检查画面'); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement); renderer.domElement.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', pageVisibility); setView('front'); resize(); observer.observe(host); renderer.setAnimationLoop(tick); publish();
  } catch (error) { dispose(); throw error; }
  return { prepare, cancelPreparation, enterVR, exitVR, calibrate, start, stop: () => stop(), play, pause, setView, importTake, take: () => take, dispose };
}
