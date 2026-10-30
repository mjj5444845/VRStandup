import {
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export type ScenePreview = {
  start: () => void;
  stop: () => void;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
  dispose: () => void;
};

type PreviewOptions = {
  onFailure: (message: string) => void;
  enableVR?: boolean;
  onVrEnded?: () => void;
};

// These values belong to this desktop check, not to the study's device budget.
const MAX_PIXEL_RATIO = 2;
const MAX_FRAME_DELTA_S = 0.05;
const ROTATION_RAD_PER_S = 0.5;

/** Owns one temporary canvas and all resources needed by the display check. */
export function createScenePreview(
  container: HTMLElement,
  { onFailure, enableVR = false, onVrEnded }: PreviewOptions,
): ScenePreview {
  // Construct the renderer before allocating scene resources so an unsupported
  // browser can fail without leaving geometry or materials behind.
  const renderer = new WebGLRenderer({ antialias: true });
  const canvas = renderer.domElement;
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  const geometry = new BoxGeometry(1.4, 1.4, 1.4);
  const material = new MeshStandardMaterial({ color: '#387b60', roughness: 0.45 });
  const cube = new Mesh(geometry, material);
  const grid = new GridHelper(8, 16, '#acb8ad', '#d8dfd6');
  let resizeObserver: ResizeObserver | undefined;
  let running = false;
  let disposed = false;
  let failed = false;
  let previousTimeMs: number | undefined;
  let activeSession: XRSession | undefined;
  let pendingVR: Promise<void> | undefined;
  let graphicsReleased = false;

  function stop() {
    running = false;
    previousTimeMs = undefined;
    renderer.setAnimationLoop(null);
  }

  function fail(message: string) {
    if (disposed || failed) return;
    failed = true;
    stop();
    void exitVR().catch(() => {});
    onFailure(message);
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    fail('三维画面已中断，请点击“重新加载”重试。');
  }

  function resize() {
    if (disposed || failed || activeSession) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Resizing must also update the picture while rotation is paused.
    renderer.render(scene, camera);
  }

  function tick(timeMs: number) {
    if (!running || disposed || failed) return;
    // Limit the step after a hidden tab resumes, avoiding a sudden large jump.
    const deltaS = previousTimeMs === undefined
      ? 0
      : Math.min((timeMs - previousTimeMs) / 1000, MAX_FRAME_DELTA_S);
    previousTimeMs = timeMs;
    cube.rotation.y += deltaS * ROTATION_RAD_PER_S;
    try {
      renderer.render(scene, camera);
    } catch {
      fail('三维画面无法继续显示，请点击“重新加载”重试。');
    }
  }

  function start() {
    if (running || disposed || failed) return;
    running = true;
    previousTimeMs = undefined;
    // Keep one animation loop, matching the future WebXR engine's approach.
    renderer.setAnimationLoop(tick);
  }

  function releaseGraphics() {
    if (graphicsReleased) return;
    graphicsReleased = true;
    geometry.dispose();
    material.dispose();
    grid.geometry.dispose();
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((gridMaterial) => gridMaterial.dispose());
    scene.clear();
    renderer.dispose();
    // Release the old context too when React remounts or the user retries.
    renderer.forceContextLoss();
  }

  function restoreDesktopCamera() {
    camera.position.set(3.6, 2.4, 4.2);
    camera.lookAt(0, enableVR ? 1.4 : 0, enableVR ? -2 : 0);
  }

  function handleSessionEnd() {
    activeSession?.removeEventListener('end', handleSessionEnd);
    activeSession = undefined;
    if (disposed) return;
    onVrEnded?.();
    // Let Three.js finish its own session-end handler before restoring the canvas.
    queueMicrotask(() => {
      if (disposed || failed) return;
      try {
        restoreDesktopCamera();
        resize();
      } catch {
        fail('退出 VR 后画面无法恢复，请重新加载。');
      }
    });
  }

  function enterVR(): Promise<void> {
    if (disposed || failed || !enableVR || !navigator.xr) return Promise.reject(new Error('VR unavailable'));
    if (pendingVR) return pendingVR;
    if (activeSession) return Promise.resolve();
    // Request directly in the user's click call chain; no awaited checks first.
    let request: Promise<XRSession>;
    try {
      request = navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
    } catch (error) {
      return Promise.reject(error);
    }
    pendingVR = (async () => {
      const session = await request;
      if (disposed || failed) {
        await session.end();
        throw new Error('Preview already disposed');
      }
      activeSession = session;
      session.addEventListener('end', handleSessionEnd);
      try {
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        await renderer.xr.setSession(session);
        if (disposed || failed || activeSession !== session || !renderer.xr.isPresenting) {
          throw new Error('XR session did not remain active');
        }
        start();
      } catch (error) {
        await session.end().catch(() => {});
        if (activeSession === session) handleSessionEnd();
        throw error;
      }
    })().finally(() => { pendingVR = undefined; });
    return pendingVR;
  }

  async function exitVR() {
    if (activeSession) await activeSession.end();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver?.disconnect();
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.remove();
    const session = activeSession;
    if (session) {
      // An in-flight XR attachment must settle before its graphics are released.
      void (pendingVR ?? Promise.resolve()).catch(() => {}).then(async () => {
        session.removeEventListener('end', handleSessionEnd);
        await session.end().catch(() => {});
      }).finally(releaseGraphics);
    } else {
      // A late permission result sees disposed=true and ends without attaching.
      releaseGraphics();
    }
  }

  try {
    scene.background = new Color('#edf1e9');
    restoreDesktopCamera();
    cube.rotation.set(0.15, 0.35, 0);
    grid.position.y = -0.72;
    if (enableVR) {
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      cube.position.set(0, 1.4, -2);
      grid.position.y = 0;
    }
    scene.add(cube, grid, new HemisphereLight('#ffffff', '#89957c', 2.5));
    const light = new DirectionalLight('#fff5de', 3);
    light.position.set(3, 5, 2);
    scene.add(light);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '绿色方块与地面网格的三维画面');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', handleContextLost);
    container.appendChild(canvas);
    resize();
    resizeObserver = new ResizeObserver(() => {
      try {
        resize();
      } catch {
        fail('调整窗口后画面无法显示，请点击“重新加载”重试。');
      }
    });
    resizeObserver.observe(container);
  } catch (error) {
    dispose();
    throw error;
  }

  return { start, stop, enterVR, exitVR, dispose };
}
