import {
  BoxGeometry, Color, DirectionalLight, GridHelper, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry,
  WebGLRenderer, type BufferGeometry, type Material,
} from 'three';
import { createReplayAudio, createReplayFixture } from './replay-fixture';
import { INITIAL_TRANSPORT, JOINTS, pauseTransport, sampleReplay, startTransport, transportTime, type Joint, type PoseFrame, type Transport } from './replay-rules';

export type View = 'front' | 'left' | 'right';
export type MarkerRecord = { markerMs: number; sampledAtMs: number; submittedAtMs: number; submissionDelayMs: number };
export type ReplayReport = {
  version: 1; source: 'synthetic'; clipId: string; createdAt: string; browser: string;
  durationMs: number; positionMs: number; reachedEnd: boolean; sampleRate: number | null;
  resumes: number; interruptions: number; renderedFrames: number; maxFrameGapMs: number;
  observedMissingLeftHand: boolean; markers: MarkerRecord[];
  measurement: string;
};
export type ReplayState = {
  phase: Transport['phase'] | 'starting' | 'error'; message: string;
  positionMs: number; missing: Joint[]; markerCount: number; maxSubmissionDelayMs: number;
  maxFrameGapMs: number; resumes: number; interruptions: number;
};
export const INITIAL_REPLAY: ReplayState = {
  phase: 'idle', message: '已载入 12 秒测试片段。点击开始，允许浏览器播放节拍声。',
  positionMs: 0, missing: [], markerCount: 0, maxSubmissionDelayMs: 0,
  maxFrameGapMs: 0, resumes: 0, interruptions: 0,
};
export type ReplayCheck = {
  play: () => Promise<void>; pause: () => void; reset: () => void;
  setView: (view: View) => void; report: () => ReplayReport; dispose: () => void;
};

/** Owns one audio clock and one rendering loop for the temporary replay check. */
export function createReplayCheck(container: HTMLElement, onChange: (state: ReplayState) => void): ReplayCheck {
  const clip = createReplayFixture();
  const renderer = new WebGLRenderer({ antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 40);
  const actor = new Group();
  const geometry: BufferGeometry[] = [];
  const materials: Material[] = [];
  const points = {} as Record<Joint, Mesh>;
  const rows: MarkerRecord[] = [];
  let observer: ResizeObserver | undefined;
  let disposed = false, failed = false, starting = false;
  let transport: Transport = { ...INITIAL_TRANSPORT };
  let context: AudioContext | undefined;
  let buffer: AudioBuffer | undefined;
  let source: AudioBufferSourceNode | undefined;
  let generation = 0;
  let message = INITIAL_REPLAY.message;
  let lastPublishMs = -Infinity;
  let previousFrameMs: number | undefined;
  let maxFrameGapMs = 0, renderedFrames = 0, resumes = 0, interruptions = 0;
  let observedMissingLeftHand = false;
  let createdAt = new Date().toISOString();
  let pulse: Mesh;
  const pulseMaterial = new MeshBasicMaterial({ color: '#6d8776' });
  materials.push(pulseMaterial);

  function position() { return transportTime(transport, context?.currentTime ?? 0, clip.durationMs); }
  function publish(force = false) {
    if (disposed) return;
    const now = performance.now();
    if (!force && now - lastPublishMs < 100) return;
    lastPublishMs = now;
    const positionMs = position();
    const sample = sampleReplay(clip, positionMs);
    onChange({
      phase: failed ? 'error' : starting ? 'starting' : transport.phase, message, positionMs,
      missing: JOINTS.filter((joint) => sample[joint] === null), markerCount: rows.length,
      maxSubmissionDelayMs: Math.max(0, ...rows.map((row) => row.submissionDelayMs)),
      maxFrameGapMs, resumes, interruptions,
    });
  }
  function stopSource() {
    if (!source) return;
    source.stop(); source.disconnect(); source = undefined;
  }
  function apply(frame: PoseFrame) {
    for (const name of JOINTS) {
      const point = frame[name];
      points[name].visible = point !== null;
      if (point) {
        points[name].position.set(...point.position);
        points[name].quaternion.set(...point.orientation);
      }
    }
    const lit = clip.markersMs.some((marker) => frame.tMs >= marker && frame.tMs < marker + 120);
    pulseMaterial.color.set(lit ? '#edb94f' : '#6d8776');
    pulse.scale.setScalar(lit ? 1.35 : 1);
  }
  function pause(reason = '已暂停，动作与声音停在同一进度。') {
    if (disposed || failed) return;
    generation++;
    starting = false;
    transport = pauseTransport(transport, context?.currentTime ?? 0, clip.durationMs);
    stopSource(); previousFrameMs = undefined;
    message = reason;
    apply(sampleReplay(clip, position()));
    publish(true);
  }
  function fail(reason: string) {
    if (disposed || failed) return;
    pause(reason);
    failed = true;
    renderer.setAnimationLoop(null);
    publish(true);
  }
  function contextLost(event: Event) { event.preventDefault(); fail('三维画面中断，请重新加载检查。'); }
  function audioStateChanged() {
    if (disposed || failed || transport.phase !== 'playing') return;
    if (context?.state === 'suspended') { interruptions++; pause('声音环境已暂停。请回到页面后点击继续。'); }
    if (context?.state === 'closed') fail('声音环境已关闭，请重新加载检查。');
  }
  function visibilityChanged() {
    if (document.hidden && (starting || transport.phase === 'playing')) {
      interruptions++;
      pause('页面进入后台，已暂停。请回到前台后点击继续。');
    }
  }
  function clearRun() {
    rows.length = 0; previousFrameMs = undefined;
    maxFrameGapMs = 0; renderedFrames = 0; resumes = 0; interruptions = 0;
    observedMissingLeftHand = false; createdAt = new Date().toISOString();
  }
  function reset() {
    if (disposed || failed) return;
    generation++; starting = false; stopSource();
    transport = { ...INITIAL_TRANSPORT }; clearRun();
    message = '已回到开头。点击开始播放。';
    apply(sampleReplay(clip, 0)); publish(true);
  }
  async function play() {
    if (disposed || failed || starting || transport.phase === 'playing') return;
    if (transport.phase === 'ended') reset();
    const wasPaused = transport.phase === 'paused';
    starting = true;
    message = '正在开启声音…'; publish(true);
    const id = ++generation;
    try {
      // Create/resume inside the user gesture, before the first await.
      if (!context) {
        context = new AudioContext();
        context.addEventListener('statechange', audioStateChanged);
      }
      const audio = context;
      await audio.resume();
      if (disposed || failed || id !== generation) return;
      if (audio.state !== 'running') throw new Error('Audio unavailable');
      if (!buffer) {
        const samples = createReplayAudio(audio.sampleRate, clip);
        buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
        buffer.getChannelData(0).set(samples);
      }
      const next = audio.createBufferSource();
      next.buffer = buffer; next.connect(audio.destination);
      // This 50 ms lead is scheduling headroom, not a synchronization acceptance limit.
      const anchorS = audio.currentTime + 0.05;
      const nextTransport = startTransport(transport, anchorS, clip.durationMs);
      try { next.start(anchorS, nextTransport.offsetMs / 1000); }
      catch (error) { next.disconnect(); throw error; }
      source = next;
      transport = nextTransport;
      starting = false; previousFrameMs = undefined;
      if (wasPaused) resumes++;
      message = '正在回放。每次节拍声对应右手抬高和上方圆灯闪亮。';
      publish(true);
    } catch {
      if (disposed || id !== generation) return;
      fail('声音未能开始，请检查浏览器权限或重新加载检查。');
    }
  }
  function setView(view: View) {
    const x = view === 'front' ? 0 : view === 'left' ? -3.5 : 3.5;
    camera.position.set(x, 2.1, view === 'front' ? 4.5 : 3.6);
    camera.lookAt(0, 1.15, 0);
  }
  function resize() {
    if (disposed || failed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function tick() {
    if (disposed || failed) return;
    try {
      const timeMs = position();
      const frame = sampleReplay(clip, timeMs);
      apply(frame);
      renderer.render(scene, camera);
      if (transport.phase === 'playing' && timeMs > 0) {
        // Do not clamp late submissions to duration: an end-of-clip stall must remain visible.
        const submittedMs = transport.offsetMs + Math.max(0, (context?.currentTime ?? transport.anchorS) - transport.anchorS) * 1000;
        renderedFrames++;
        if (previousFrameMs !== undefined) maxFrameGapMs = Math.max(maxFrameGapMs, submittedMs - previousFrameMs);
        previousFrameMs = submittedMs;
        observedMissingLeftHand ||= frame.leftHand === null;
        for (const marker of clip.markersMs) {
          if (timeMs >= marker && !rows.some((row) => row.markerMs === marker)) {
            rows.push({ markerMs: marker, sampledAtMs: timeMs, submittedAtMs: submittedMs, submissionDelayMs: submittedMs - marker });
          }
        }
        if (timeMs >= clip.durationMs) {
          transport = { phase: 'ended', offsetMs: clip.durationMs, anchorS: context?.currentTime ?? 0 };
          stopSource(); previousFrameMs = undefined;
          message = '12 秒回放已结束。请查看节拍记录，也可以再次播放。此结果不代表真实录制已通过。';
          publish(true);
        }
      }
      publish();
    } catch { fail('回放画面无法继续，请重新加载检查。'); }
  }
  function report(): ReplayReport {
    return {
      version: 1, source: 'synthetic', clipId: clip.id, createdAt, browser: navigator.userAgent,
      durationMs: clip.durationMs, positionMs: position(), reachedEnd: transport.phase === 'ended',
      sampleRate: context?.sampleRate ?? null, resumes, interruptions, renderedFrames, maxFrameGapMs,
      observedMissingLeftHand, markers: rows.map((row) => ({ ...row })),
      measurement: 'First CPU submission at/after each scheduled audio marker, measured on AudioContext.currentTime. Not speaker/display latency, motion-capture error, or a research pass/fail verdict.',
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++;
    renderer.setAnimationLoop(null); observer?.disconnect(); stopSource();
    document.removeEventListener('visibilitychange', visibilityChanged);
    if (context) {
      context.removeEventListener('statechange', audioStateChanged);
      void context.close().catch(() => {});
    }
    buffer = undefined;
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    renderer.domElement.remove();
    geometry.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
    scene.clear(); renderer.dispose(); renderer.forceContextLoss();
  }

  try {
    function point(name: Joint, shape: BufferGeometry, color: string) {
      geometry.push(shape);
      const material = new MeshStandardMaterial({ color, roughness: 0.65 }); materials.push(material);
      const mesh = new Mesh(shape, material); points[name] = mesh; actor.add(mesh);
    }
    point('head', new BoxGeometry(0.3, 0.34, 0.26), '#427d70');
    point('leftHand', new SphereGeometry(0.085, 16, 12), '#559ec4');
    point('rightHand', new SphereGeometry(0.085, 16, 12), '#d89a32');
    const eyeShape = new SphereGeometry(0.026, 10, 8); geometry.push(eyeShape);
    const eyeMaterial = new MeshBasicMaterial({ color: '#f5f5ef' }); materials.push(eyeMaterial);
    for (const x of [-0.075, 0.075]) {
      const eye = new Mesh(eyeShape, eyeMaterial); eye.position.set(x, 0.02, -0.135); points.head.add(eye);
    }
    // Static torso is a visual placeholder, not a recorded or inferred full body.
    const torsoShape = new BoxGeometry(0.34, 0.65, 0.2); geometry.push(torsoShape);
    const torsoMaterial = new MeshStandardMaterial({ color: '#ccd4ce', roughness: 0.9 }); materials.push(torsoMaterial);
    const torso = new Mesh(torsoShape, torsoMaterial); torso.position.y = 1.08; actor.add(torso);
    actor.rotation.y = Math.PI;
    const pulseShape = new SphereGeometry(0.08, 16, 12); geometry.push(pulseShape);
    pulse = new Mesh(pulseShape, pulseMaterial); pulse.position.set(0, 2.15, 0); scene.add(pulse);
    const grid = new GridHelper(6, 12, '#9cae9e', '#d9e0d5');
    geometry.push(grid.geometry);
    materials.push(...(Array.isArray(grid.material) ? grid.material : [grid.material]));
    scene.add(actor, grid, new HemisphereLight('#ffffff', '#869481', 2.5));
    const light = new DirectionalLight('#fff1d5', 2.5); light.position.set(2, 4, 3); scene.add(light);
    scene.background = new Color('#edf1e9');
    setView('front'); apply(sampleReplay(clip, 0));
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '头部与双手的三维动作回放');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    canvas.addEventListener('webglcontextlost', contextLost); container.appendChild(canvas);
    document.addEventListener('visibilitychange', visibilityChanged);
    observer = new ResizeObserver(() => { try { resize(); } catch { fail('调整窗口后画面不可用，请重新加载检查。'); } });
    observer.observe(container); resize(); renderer.setAnimationLoop(tick); publish(true);
  } catch (error) { dispose(); throw error; }
  return { play, pause: () => pause(), reset, setView, report, dispose };
}
