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
  const sceneRef = useRef<VRSceneElement | null>(null);
  const selectedAvatar = getAvatar(selectedId);

  useEffect(() => {
    let active = true;
    import('aframe')
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
    };
  }, []);

  const selectAvatar = useCallback((id: AvatarId) => {
    setSelectedId(id);
    window.localStorage.setItem(AVATAR_STORAGE_KEY, id);
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
          8 avatars ready
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
              <dd>8 位演员</dd>
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
          onSelect={selectAvatar}
          onSceneElement={(scene) => {
            sceneRef.current = scene;
          }}
        />
      </section>

      <AvatarSelector selectedId={selectedId} onSelect={selectAvatar} />

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
              <p>在网页角色卡或 VR 舞台右侧选角台选择 8 位演员中的一位。</p>
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
              <p>角色配置与舞台渲染已解耦，可继续接入脚本、动作、灯光与字幕时间线。</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <span>VR STANDUP / WEBXR EXPERIENCE</span>
        <span>8 AVATARS · INTERACTIVE CASTING</span>
      </footer>
    </main>
  );
}
