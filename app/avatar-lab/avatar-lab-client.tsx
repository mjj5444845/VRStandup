'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './avatar-lab.module.css';

const GLB_URL = '/avatars/new_avatar_mixamo/output/Ch02_nonPBR_avatar.glb';
const MANIFEST_URL = '/avatars/new_avatar_mixamo/output/Ch02_nonPBR_animations.json';
const REQUIRED_CLIPS = [
  'IDLE_Idle',
  'PERFORM_Talking1',
  'PERFORM_Waving',
  'SIT_Sitting1',
] as const;

type ManifestAnimation = {
  name: string;
  category: 'idle' | 'perform' | 'sit';
  duration_seconds: number;
  bone_match_ratio: number;
  root_motion: { detected: boolean };
};

type AnimationManifest = {
  character: string;
  bone_count: number;
  animations: ManifestAnimation[];
};

type AFrameEntity = HTMLElement & {
  enterVR?: () => Promise<void>;
};

type LoadedModel = {
  animations?: Array<{ name: string }>;
};

export function AvatarLabClient() {
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState(false);
  const [manifest, setManifest] = useState<AnimationManifest | null>(null);
  const [loadedClips, setLoadedClips] = useState<string[]>([]);
  const [currentClip, setCurrentClip] = useState<string>('IDLE_Idle');
  const [modelReady, setModelReady] = useState(false);
  const sceneRef = useRef<AFrameEntity | null>(null);
  const avatarRef = useRef<AFrameEntity | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      import('aframe').then(() => import('aframe-extras')),
      fetch(MANIFEST_URL).then((response) => {
        if (!response.ok) throw new Error(`Manifest ${response.status}`);
        return response.json() as Promise<AnimationManifest>;
      }),
    ])
      .then(([, nextManifest]) => {
        if (!active) return;
        setManifest(nextManifest);
        setRuntimeReady(true);
      })
      .catch(() => {
        if (active) setRuntimeError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar || !runtimeReady) return;

    const handleModelLoaded = (event: Event) => {
      const model = (event as CustomEvent<{ model: LoadedModel }>).detail.model;
      const names = (model.animations ?? []).map((clip) => clip.name).sort();
      setLoadedClips(names);
      setModelReady(true);
    };

    avatar.addEventListener('model-loaded', handleModelLoaded);
    return () => avatar.removeEventListener('model-loaded', handleModelLoaded);
  }, [runtimeReady]);

  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar || !modelReady) return;
    avatar.setAttribute(
      'animation-mixer',
      `clip: ${currentClip}; loop: repeat; crossFadeDuration: 0.3`,
    );
  }, [currentClip, modelReady]);

  const manifestClips = manifest?.animations ?? [];
  const requiredReady = REQUIRED_CLIPS.every((clip) => loadedClips.includes(clip));

  const status = runtimeError
    ? 'A-Frame 加载失败'
    : !runtimeReady
      ? '正在加载 A-Frame…'
      : !modelReady
        ? '正在解析 GLB…'
        : requiredReady
          ? `${loadedClips.length} 个 clips 已就绪`
          : 'GLB 缺少验收 clips';

  return (
    <main className={styles.shell} data-avatar-lab-status={requiredReady ? 'passed' : 'pending'}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>VR Standup</Link>
        <span className={requiredReady ? styles.passed : styles.pending}>{status}</span>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>A-FRAME · ANIMATION-MIXER · WEBXR</p>
          <h1>Mixamo Avatar<br />动作实验室</h1>
        </div>
        <p>
          这个页面直接加载 Blender pipeline 生成的 GLB。点击 clip 名称会通过
          <code> animation-mixer </code>实时切换动作，名称与 manifest 完全一致。
        </p>
      </section>

      <section className={styles.workspace}>
        <div className={styles.viewport}>
          {runtimeReady ? (
            <a-scene
              ref={(node) => { sceneRef.current = node as AFrameEntity | null; }}
              embedded
              renderer="colorManagement: true; antialias: true; toneMapping: ACESFilmic; exposure: 1.1"
              background="color: #17141c"
              webxr="optionalFeatures: bounded-floor, hand-tracking"
            >
              <a-assets timeout="30000">
                <a-asset-item id="mixamo-avatar" src={GLB_URL} />
              </a-assets>
              <a-sky color="#17141c" />
              <a-plane
                position="0 0 0"
                rotation="-90 0 0"
                width="12"
                height="12"
                color="#332d39"
                material="roughness: 0.92; metalness: 0"
              />
              <a-circle
                position="0 0.012 0"
                rotation="-90 0 0"
                radius="1.35"
                color="#70415a"
                material="roughness: 0.9; metalness: 0"
              />
              <a-entity
                ref={(node) => { avatarRef.current = node as AFrameEntity | null; }}
                id="mixamo-performer"
                gltf-model="#mixamo-avatar"
                position="0 0 0"
                rotation="0 0 0"
                animation-mixer={`clip: ${currentClip}; loop: repeat; crossFadeDuration: 0.3`}
              />
              <a-entity light="type: ambient; color: #fff3e5; intensity: 1.1" />
              <a-entity
                position="-2.5 4 3"
                light="type: spot; color: #ffe7ce; intensity: 4; angle: 55; penumbra: 1; target: #mixamo-performer"
              />
              <a-entity
                position="2.5 3 2"
                light="type: point; color: #c6d0ff; intensity: 1.4; distance: 9; decay: 1.5"
              />
              <a-entity position="0 1.55 3.2">
                <a-camera look-controls="pointerLockEnabled: false" wasd-controls="enabled: false" />
              </a-entity>
            </a-scene>
          ) : (
            <div className={styles.loading}>{status}</div>
          )}
          <div className={styles.viewportStatus}>
            <span>{modelReady ? 'MODEL LOADED' : 'WAITING FOR MODEL'}</span>
            <strong>{currentClip}</strong>
          </div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span>CHARACTER</span>
              <strong>{manifest?.character ?? 'Ch02_nonPBR.fbx'}</strong>
            </div>
            <div>
              <span>SKELETON</span>
              <strong>{manifest ? `${manifest.bone_count} bones` : '—'}</strong>
            </div>
          </div>

          <div className={styles.clipList} aria-label="Animation clips">
            {manifestClips.map((clip) => {
              const selected = clip.name === currentClip;
              const available = loadedClips.includes(clip.name);
              return (
                <button
                  key={clip.name}
                  type="button"
                  className={selected ? styles.selectedClip : styles.clip}
                  onClick={() => setCurrentClip(clip.name)}
                  disabled={!available}
                  data-clip={clip.name}
                >
                  <span>{clip.category}</span>
                  <strong>{clip.name}</strong>
                  <small>
                    {clip.duration_seconds.toFixed(1)}s · {Math.round(clip.bone_match_ratio * 100)}%
                    {clip.root_motion.detected ? ' · root' : ''}
                  </small>
                </button>
              );
            })}
          </div>

          <button
            className={styles.vrButton}
            type="button"
            disabled={!modelReady}
            onClick={() => sceneRef.current?.enterVR?.()}
          >
            进入 VR 验证
          </button>
        </aside>
      </section>

      <section className={styles.acceptance}>
        <p className={styles.eyebrow}>RUNTIME ACCEPTANCE</p>
        <div>
          {REQUIRED_CLIPS.map((clip) => (
            <span key={clip} data-required-clip={clip} data-available={loadedClips.includes(clip)}>
              {loadedClips.includes(clip) ? '✓' : '○'} {clip}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
