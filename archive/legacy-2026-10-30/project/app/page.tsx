'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarSelector } from './components/avatar-selector';
import { VRStage } from './components/vr-stage';
import {
  DEFAULT_AVATAR_ID,
  getAvatar,
  isAvatarId,
  type AvatarId,
} from './data/avatars';

type VRSceneElement = HTMLElement & {
  enterVR?: () => Promise<void>;
};

const AVATAR_STORAGE_KEY = 'vr-standup:selected-avatar';

export default function Home() {
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [selectedId, setSelectedId] = useState<AvatarId>(DEFAULT_AVATAR_ID);
  const [voiceStatus, setVoiceStatus] = useState('点击演员即可试听对应测试语音');
  const sceneRef = useRef<VRSceneElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedAvatar = getAvatar(selectedId);

  useEffect(() => {
    let active = true;
    import('aframe')
      .then(() => import('aframe-extras'))
      .then(() => {
        if (!active) return;
        const savedAvatar = window.localStorage.getItem(AVATAR_STORAGE_KEY);
        if (savedAvatar && isAvatarId(savedAvatar)) {
          setSelectedId(savedAvatar);
        }
        setSceneReady(true);
      })
      .catch(() => {
        if (active) setSceneError(true);
      });

    return () => {
      active = false;
      audioRef.current?.pause();
    };
  }, []);

  const selectAvatar = useCallback((id: AvatarId) => {
    setSelectedId(id);
    window.localStorage.setItem(AVATAR_STORAGE_KEY, id);
    const avatar = getAvatar(id);
    audioRef.current?.pause();
    const preview = new Audio(avatar.voice);
    preview.preload = 'auto';
    audioRef.current = preview;
    setVoiceStatus(`正在播放：${avatar.name}测试语音`);
    preview.addEventListener('ended', () => {
      setVoiceStatus(`${avatar.name}测试语音播放完成`);
    }, { once: true });
    preview.play().catch(() => {
      setVoiceStatus('浏览器阻止了播放，请再次点击演员');
    });
  }, []);

  const enterVR = async () => {
    await sceneRef.current?.enterVR?.();
  };

  return (
    <main className="experience-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="VR Standup 首页">
          <span className="brand-mark" aria-hidden="true">
            VS
          </span>
          <span>VR Standup</span>
        </a>
        <span className="status-pill">
          <span className="status-dot" aria-hidden="true" />
          2 performers · 4 audience models
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">IMMERSIVE COMEDY · WEBXR</p>
          <h1>
            笑声，发生在
            <span>另一个空间。</span>
          </h1>
          <p className="lede">
            一座为浏览器与 VR 头显打造的虚拟脱口秀剧场。选择演员、戴上耳机、坐进前排，准备开场。
          </p>

          <div className="actions">
            <button
              className="primary-action"
              type="button"
              onClick={enterVR}
              disabled={!sceneReady}
            >
              {sceneReady ? '进入 VR 剧场' : '正在准备剧场…'}
              <span aria-hidden="true">↗</span>
            </button>
            <a className="secondary-action" href="#avatars">
              选择演员
            </a>
            <a className="secondary-action" href="/avatar-lab">
              动作实验室
            </a>
          </div>

          <dl className="scene-facts" aria-label="体验信息">
            <div>
              <dt>当前演员</dt>
              <dd>{selectedAvatar.name}</dd>
            </div>
            <div>
              <dt>角色库</dt>
              <dd>2 位演员</dd>
            </div>
            <div>
              <dt>控制</dt>
              <dd>鼠标 / 手柄</dd>
            </div>
          </dl>
        </div>

        <VRStage
          sceneReady={sceneReady}
          sceneError={sceneError}
          selectedId={selectedId}
          onSceneElement={(scene) => {
            sceneRef.current = scene;
          }}
        />
      </section>

      <AvatarSelector
        selectedId={selectedId}
        voiceStatus={voiceStatus}
        onSelect={selectAvatar}
      />

      <section className="controls" id="controls" aria-labelledby="controls-title">
        <div>
          <p className="eyebrow">HOW TO ENTER</p>
          <h2 id="controls-title">选角，然后开场。</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>选择演员</strong>
              <p>在网页角色卡或 VR 舞台右侧选角台选择男、女演员；点击会同时播放对应测试语音。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>进入剧场</strong>
              <p>桌面端可拖动视角并使用 WASD；头显端用右手柄指向后触发。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>准备表演</strong>
              <p>角色、动作和语音已解耦，可继续接入脚本、灯光与字幕时间线。</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <span>VR STANDUP / WEBXR EXPERIENCE</span>
        <span>2 PERFORMERS · 4 AUDIENCE MODELS · INTERACTIVE CASTING</span>
      </footer>
    </main>
  );
}
