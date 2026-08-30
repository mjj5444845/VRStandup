'use client';

import { useEffect, useRef, useState } from 'react';

type VRSceneElement = HTMLElement & {
  enterVR?: () => Promise<void>;
};

export default function Home() {
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const sceneRef = useRef<VRSceneElement | null>(null);

  useEffect(() => {
    let active = true;

    import('aframe')
      .then(() => {
        if (active) setSceneReady(true);
      })
      .catch(() => {
        if (active) setSceneError(true);
      });

    return () => {
      active = false;
    };
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
          A-Frame 1.8 ready
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
            一座为浏览器与 VR 头显打造的虚拟脱口秀剧场。戴上耳机、坐进前排，准备开场。
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
            <a className="secondary-action" href="#controls">
              查看操作方式
            </a>
          </div>

          <dl className="scene-facts" aria-label="体验信息">
            <div>
              <dt>设备</dt>
              <dd>浏览器 / VR</dd>
            </div>
            <div>
              <dt>移动</dt>
              <dd>WASD / 手柄</dd>
            </div>
            <div>
              <dt>场景</dt>
              <dd>实时 3D</dd>
            </div>
          </dl>
        </div>

        <div className="scene-card">
          <div className="scene-toolbar" aria-hidden="true">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <span>main-stage.aframe</span>
            <span className="live-label">LIVE</span>
          </div>

          <div className="scene-viewport" aria-label="虚拟脱口秀剧场实时预览">
            {sceneReady ? (
              <a-scene
                ref={(node) => {
                  sceneRef.current = node as VRSceneElement | null;
                }}
                embedded
                renderer="colorManagement: true; antialias: true"
                vr-mode-ui="enabled: false"
                loading-screen="enabled: false"
                background="color: #09080d"
              >
                <a-sky color="#09080d" />

                <a-plane
                  position="0 0 -2"
                  rotation="-90 0 0"
                  width="18"
                  height="18"
                  color="#17151d"
                  material="roughness: 0.88; metalness: 0.08"
                />

                <a-box
                  position="0 0.35 -4.5"
                  width="6.5"
                  height="0.7"
                  depth="3"
                  color="#221a29"
                  material="roughness: 0.65"
                />
                <a-box
                  position="0 2.7 -6"
                  width="8"
                  height="5.4"
                  depth="0.25"
                  color="#4f1028"
                  material="roughness: 0.82"
                />

                <a-cylinder
                  position="0 1.35 -4.35"
                  radius="0.08"
                  height="1.7"
                  color="#d9c4aa"
                  material="metalness: 0.75; roughness: 0.22"
                />
                <a-sphere
                  position="0 2.22 -4.35"
                  radius="0.14"
                  color="#f1c15e"
                  material="emissive: #b96524; emissiveIntensity: 0.25; metalness: 0.5"
                />
                <a-ring
                  position="0.14 1.93 -4.35"
                  rotation="90 0 0"
                  radius-inner="0.12"
                  radius-outer="0.16"
                  color="#c6a66e"
                />

                <a-text
                  value="VR STANDUP"
                  position="0 3.5 -5.8"
                  align="center"
                  width="7"
                  color="#f5ddbf"
                  material="emissive: #c85b36; emissiveIntensity: 0.75"
                />
                <a-text
                  value="TONIGHT / 21:00"
                  position="0 3 -5.76"
                  align="center"
                  width="4.2"
                  color="#d47f67"
                />

                <a-cylinder
                  position="-1.8 0.55 -1.8"
                  radius="0.55"
                  height="0.7"
                  color="#302a37"
                />
                <a-cylinder
                  position="0 0.55 -1.5"
                  radius="0.55"
                  height="0.7"
                  color="#302a37"
                />
                <a-cylinder
                  position="1.8 0.55 -1.8"
                  radius="0.55"
                  height="0.7"
                  color="#302a37"
                />

                <a-entity
                  light="type: ambient; color: #9c8195; intensity: 0.45"
                />
                <a-entity
                  position="0 4.8 -2.5"
                  light="type: spot; color: #ffd6a5; intensity: 16; angle: 28; penumbra: 0.7; target: #mic"
                />
                <a-entity
                  position="-3.6 2.5 -2"
                  light="type: point; color: #cf315e; intensity: 6; distance: 8"
                />
                <a-entity
                  position="3.6 2.5 -2"
                  light="type: point; color: #4e60d9; intensity: 5; distance: 8"
                />

                <a-entity id="mic" position="0 1.45 -4.35" />
                <a-entity position="0 1.65 2.8">
                  <a-camera
                    look-controls="pointerLockEnabled: false"
                    wasd-controls="acceleration: 18"
                  />
                </a-entity>
              </a-scene>
            ) : (
              <div className="scene-loading" role="status">
                <span className="loader-ring" aria-hidden="true" />
                <p>{sceneError ? '剧场加载失败，请刷新重试。' : '正在点亮舞台…'}</p>
              </div>
            )}
          </div>

          <div className="scene-caption">
            <div>
              <span className="caption-kicker">SCENE 01</span>
              <strong>午夜俱乐部</strong>
            </div>
            <p>拖动视角 · WASD 移动</p>
          </div>
        </div>
      </section>

      <section className="controls" id="controls" aria-labelledby="controls-title">
        <div>
          <p className="eyebrow">HOW TO ENTER</p>
          <h2 id="controls-title">不需要安装应用。</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>打开剧场</strong>
              <p>使用现代浏览器访问，桌面与移动设备均可体验。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>连接头显</strong>
              <p>支持 WebXR 的设备会直接进入沉浸模式。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>坐进前排</strong>
              <p>环顾舞台、自由移动，等待下一位演员登场。</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <span>VR STANDUP / WEBXR EXPERIENCE</span>
        <span>Built with A-Frame</span>
      </footer>
    </main>
  );
}
