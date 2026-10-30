import {
  Color, DataTexture, DoubleSide, Mesh, NoBlending, NoColorSpace, OrthographicCamera,
  PerspectiveCamera, PlaneGeometry, RGBAFormat, Scene, ShaderMaterial, Texture,
  Vector3, VideoTexture, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { CB, CR, chromaAlpha, DEFAULT_CHROMA, keyRGB, validateChroma, type ChromaSettings } from './chroma-key-rules';

function createMaterial(texture: Texture, settings: ChromaSettings) {
  return new ShaderMaterial({
    uniforms: {
      video: { value: texture }, key: { value: new Vector3(...keyRGB(settings)) },
      cb: { value: new Vector3(...CB) }, cr: { value: new Vector3(...CR) },
      similarity: { value: settings.similarity }, smoothness: { value: settings.smoothness },
      spill: { value: settings.spill },
    },
    vertexShader: `varying vec2 frameUv;
      void main() {
        frameUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D video;
      uniform vec3 key, cb, cr;
      uniform float similarity, smoothness, spill;
      varying vec2 frameUv;
      void main() {
        vec4 sampleColor = texture2D(video, frameUv);
        vec3 rgb = sampleColor.rgb;
        vec3 delta = rgb - key;
        float distanceToKey = length(vec2(dot(delta, cb), dot(delta, cr)));
        float alpha = smoothstep(similarity, similarity + smoothness, distanceToKey);
        if (alpha < 0.001) discard;
        // Suppress key-colored reflection only in the partially transparent edge.
        float keyLuma = dot(key, vec3(0.299, 0.587, 0.114));
        vec3 axis = key - vec3(keyLuma);
        float axisLength = length(axis);
        if (axisLength > 0.001) {
          axis /= axisLength;
          float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
          float excess = max(0.0, dot(rgb - vec3(luma), axis));
          rgb = clamp(rgb - axis * excess * spill * (1.0 - alpha), 0.0, 1.0);
        }
        // Compare encoded colors first, then decode once for Three's linear pipeline.
        gl_FragColor = vec4(sRGBTransferEOTF(vec4(rgb, 1.0)).rgb, alpha * sampleColor.a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false,
  });
}

/** Read actual GPU alpha, checking the shader instead of only duplicating its math. */
function verifyShader(renderer: WebGLRenderer): number[] {
  const key = keyRGB(DEFAULT_CHROMA);
  const samples = [key, [0.9, 0.15, 0.2], [1, 1, 1], [key[0], key[1] * 0.48, key[2]]] as const;
  const bytes = new Uint8Array(samples.flatMap((rgb) => [...rgb.map((v) => Math.round(v * 255)), 255]));
  const texture = new DataTexture(bytes, samples.length, 1, RGBAFormat);
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  const material = createMaterial(texture, DEFAULT_CHROMA);
  material.transparent = false;
  material.blending = NoBlending;
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const target = new WebGLRenderTarget(samples.length, 1);
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new Color());
  const previousAlpha = renderer.getClearAlpha();
  try {
    renderer.setClearColor(0, 0);
    renderer.setRenderTarget(target);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
    camera.position.z = 1;
    renderer.render(scene, camera);
    const pixels = new Uint8Array(samples.length * 4);
    renderer.readRenderTargetPixels(target, 0, 0, samples.length, 1, pixels);
    const alphas = samples.map((_, i) => pixels[i * 4 + 3]);
    samples.forEach((_, i) => {
      const rounded = [bytes[i * 4] / 255, bytes[i * 4 + 1] / 255, bytes[i * 4 + 2] / 255] as const;
      if (Math.abs(alphas[i] / 255 - chromaAlpha(rounded, DEFAULT_CHROMA)) > 2 / 255) {
        throw new Error('GPU transparency check failed');
      }
    });
    return alphas;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    target.dispose(); material.dispose(); geometry.dispose(); texture.dispose(); scene.clear();
  }
}

export type ChromaPreview = {
  update: (settings: ChromaSettings) => void;
  setBackground: (color: string) => void;
  resizeVideo: () => void;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
  gpuAlphas: number[];
  dispose: () => void;
};

/** Temporary S4 view. Owns one rendering loop; React owns the video and its URL. */
export function createChromaPreview(
  container: HTMLElement, video: HTMLVideoElement,
  onFailure: (message: string) => void, onVrChange: (active: boolean) => void,
): ChromaPreview {
  const renderer = new WebGLRenderer({ antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 30);
  const texture = new VideoTexture(video);
  // Sampling must return encoded video RGB for chroma distance, not auto-decoded RGB.
  texture.colorSpace = NoColorSpace;
  const geometry = new PlaneGeometry(1, 1);
  const material = createMaterial(texture, DEFAULT_CHROMA);
  const panel = new Mesh(geometry, material);
  let disposed = false;
  let failed = false;
  let released = false;
  let session: XRSession | undefined;
  let pending: Promise<void> | undefined;
  let observer: ResizeObserver | undefined;
  let gpuAlphas: number[];

  function desktopCamera() {
    camera.position.set(0, 1.5, 0.4);
    camera.rotation.set(0, 0, 0);
  }
  function resize() {
    if (disposed || failed || session) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function fail(message: string) {
    if (disposed || failed) return;
    failed = true;
    renderer.setAnimationLoop(null);
    video.pause();
    void session?.end().catch(() => {});
    onFailure(message);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    fail('三维画面已中断，请重新加载预览。');
  }
  function ended() {
    session?.removeEventListener('end', ended);
    session = undefined;
    if (disposed) return;
    onVrChange(false);
    queueMicrotask(() => { if (!disposed && !failed) { desktopCamera(); resize(); } });
  }
  function release() {
    if (released) return;
    released = true;
    texture.dispose(); material.dispose(); geometry.dispose(); scene.clear();
    renderer.dispose(); renderer.forceContextLoss();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    observer?.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    renderer.domElement.remove();
    const active = session;
    if (active) {
      void (pending ?? Promise.resolve()).catch(() => {}).then(async () => {
        active.removeEventListener('end', ended);
        await active.end().catch(() => {});
      }).finally(release);
    } else release();
  }
  function enterVR(): Promise<void> {
    if (disposed || failed || !navigator.xr) return Promise.reject(new Error('VR unavailable'));
    if (pending) return pending;
    if (session) return Promise.resolve();
    // Preserve the click gesture: request the session before any awaited operation.
    const requested = navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
    pending = (async () => {
      const active = await requested;
      if (disposed || failed) { await active.end(); return; }
      session = active;
      active.addEventListener('end', ended);
      try {
        camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
        await renderer.xr.setSession(active);
        if (disposed || failed || session !== active || !renderer.xr.isPresenting) throw new Error('VR ended');
        onVrChange(true);
      } catch (error) {
        await active.end().catch(() => {});
        if (session === active) ended();
        throw error;
      }
    })().finally(() => { pending = undefined; });
    return pending;
  }
  try {
    renderer.debug.onShaderError = () => fail('去背景着色器无法在当前设备运行，请记录浏览器版本。');
    gpuAlphas = verifyShader(renderer);
    if (failed) throw new Error('Shader compilation failed');
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    scene.background = new Color('#293e50');
    panel.position.set(0, 1.5, -2.2);
    panel.scale.set(3.2, 1.8, 1);
    scene.add(panel);
    desktopCamera();
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '去除绿色背景后的视频三维预览');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    canvas.addEventListener('webglcontextlost', contextLost);
    container.appendChild(canvas);
    observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    renderer.setAnimationLoop(() => {
      if (disposed || failed) return;
      try { renderer.render(scene, camera); }
      catch { fail('三维预览无法继续，请重新加载。'); }
    });
  } catch (error) { dispose(); throw error; }

  return {
    gpuAlphas,
    update(settings) {
      validateChroma(settings);
      material.uniforms.key.value.set(...keyRGB(settings));
      for (const name of ['similarity', 'smoothness', 'spill'] as const) material.uniforms[name].value = settings[name];
    },
    setBackground(color) { scene.background = new Color(color); },
    resizeVideo() {
      if (disposed) return;
      const aspect = video.videoWidth / video.videoHeight;
      if (Number.isFinite(aspect) && aspect > 0) panel.scale.set(Math.min(3.2, 1.8 * aspect), Math.min(1.8, 3.2 / aspect), 1);
    },
    enterVR,
    async exitVR() { await session?.end(); },
    dispose,
  };
}
