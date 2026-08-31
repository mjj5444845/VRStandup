'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AVATARS, getAvatar, type AvatarId } from '../data/avatars';
import styles from './avatar-lab.module.css';

const CLIPS = [
  'IDLE_Idle',
  'IDLE_Idle2',
  'PERFORM_Agreeing',
  'PERFORM_Standing_Greeting',
  'PERFORM_Talking1',
  'PERFORM_Talking2',
  'PERFORM_Talking3',
  'PERFORM_Waving',
  'SIT_Sitting1',
  'SIT_Sitting2',
  'SIT_Sitting3',
  'SIT_Sitting4',
  'SIT_Sitting_Clap',
  'SIT_Sitting_Idle1',
  'SIT_Sitting_Idle2',
  'SIT_Sitting_Laughing',
] as const;

const REQUIRED_CLIPS = [
  'IDLE_Idle',
  'PERFORM_Talking1',
  'PERFORM_Waving',
  'SIT_Sitting1',
] as const;

type AFrameEntity = HTMLElement & { enterVR?: () => Promise<void> };
type LoadedModel = { animations?: Array<{ name: string }> };

export function AvatarLabClient() {
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState(false);
  const [selectedId, setSelectedId] = useState<AvatarId>('female-ch02');
  const [avatarNode, setAvatarNode] = useState<AFrameEntity | null>(null);
  const [loadedClips, setLoadedClips] = useState<string[]>([]);
  const [currentClip, setCurrentClip] = useState<string>('IDLE_Idle');
  const [modelReady, setModelReady] = useState(false);
  const sceneRef = useRef<AFrameEntity | null>(null);
  const selectedAvatar = getAvatar(selectedId);

  useEffect(() => {
    let active = true;
    import('aframe')
      .then(() => import('aframe-extras'))
      .then(() => { if (active) setRuntimeReady(true); })
      .catch(() => { if (active) setRuntimeError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!avatarNode || !runtimeReady) return;
    const handleModelLoaded = (event: Event) => {
      const model = (event as CustomEvent<{ model: LoadedModel }>).detail.model;
      setLoadedClips((model.animations ?? []).map((clip) => clip.name).sort());
      setModelReady(true);
    };
    avatarNode.addEventListener('model-loaded', handleModelLoaded);
    return () => avatarNode.removeEventListener('model-loaded', handleModelLoaded);
  }, [avatarNode, runtimeReady]);

  useEffect(() => {
    if (!avatarNode || !modelReady) return;
    avatarNode.setAttribute(
      'animation-mixer',
      `clip: ${currentClip}; loop: repeat; crossFadeDuration: 0.3`,
    );
  }, [avatarNode, currentClip, modelReady]);

  const chooseAvatar = (id: AvatarId) => {
    setSelectedId(id);
    setCurrentClip('IDLE_Idle');
    setLoadedClips([]);
    setModelReady(false);
    setAvatarNode(null);
  };

  const requiredReady = REQUIRED_CLIPS.every((clip) => loadedClips.includes(clip));
  const status = runtimeError
    ? 'A-Frame 加载失败'
    : !runtimeReady
      ? '正在加载 A-Frame…'
      : !modelReady
        ? '正在解析演员 GLB…'
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
          <p className={styles.eyebrow}>2 PERFORMERS · A-FRAME · WEBXR</p>
          <h1>Mixamo Avatar<br />动作实验室</h1>
        </div>
        <p>
          这个页面直接加载当前系统使用的两位轻量 GLB。可切换男女演员，再通过
          <code> animation-mixer </code>逐项验证 16 个动作。
        </p>
      </section>

      <section className={styles.workspace}>
        <div className={styles.viewport}>
          {runtimeReady ? (
            <a-scene
              ref={(node) => { sceneRef.current = node as AFrameEntity | null; }}
              embedded
              renderer="colorManagement: true; antialias: true; toneMapping: ACESFilmic; exposure: 1.02"
              background="color: #91d6ff"
              webxr="optionalFeatures: bounded-floor, hand-tracking"
            >
              <a-sky color="#91d6ff" />
              <a-plane position="0 0 0" rotation="-90 0 0" width="12" height="12" color="#91bc72" material="roughness: 1; metalness: 0" />
              <a-circle position="0 0.012 0" rotation="-90 0 0" radius="1.35" color="#e2d1b6" material="roughness: 0.96; metalness: 0" />
              <a-entity
                key={selectedId}
                ref={(node) => { setAvatarNode(node as AFrameEntity | null); }}
                id="mixamo-performer"
                gltf-model={`url(${selectedAvatar.model})`}
                position="0 0 0"
                rotation="0 180 0"
                animation-mixer={`clip: ${currentClip}; loop: repeat; crossFadeDuration: 0.3`}
              />
              <a-entity light="type: ambient; color: #e8f7ff; intensity: 1.2" />
              <a-entity position="-4 7 4" light="type: directional; color: #fff2d1; intensity: 2" />
              <a-entity position="0 1.55 3.2"><a-camera look-controls="pointerLockEnabled: false" wasd-controls="enabled: false" /></a-entity>
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
            <div><span>CHARACTER</span><strong>{selectedAvatar.name}</strong></div>
            <div><span>SKELETON</span><strong>65 bones</strong></div>
          </div>

          <div className={styles.performerSwitch} aria-label="选择实验室演员">
            {AVATARS.map((avatar) => (
              <button
                type="button"
                key={avatar.id}
                className={avatar.id === selectedId ? styles.selectedPerformer : styles.performer}
                onClick={() => chooseAvatar(avatar.id)}
              >
                {avatar.shortLabel} · {avatar.gender.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.clipList} aria-label="Animation clips">
            {CLIPS.map((clip) => {
              const selected = clip === currentClip;
              const available = loadedClips.includes(clip);
              return (
                <button
                  key={clip}
                  type="button"
                  className={selected ? styles.selectedClip : styles.clip}
                  onClick={() => setCurrentClip(clip)}
                  disabled={!available}
                  data-clip={clip}
                >
                  <span>{clip.split('_')[0]}</span>
                  <strong>{clip}</strong>
                  <small>{available ? 'runtime ready' : 'loading'}</small>
                </button>
              );
            })}
          </div>

          <button className={styles.vrButton} type="button" disabled={!modelReady} onClick={() => sceneRef.current?.enterVR?.()}>
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
