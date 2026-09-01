import { useEffect, useState } from 'react';
import {
  AUDIENCE_AVATARS,
  getAvatar,
  type AudienceClip,
  type AvatarId,
} from '../data/avatars';

type VRSceneElement = HTMLElement & {
  enterVR?: () => Promise<void>;
};

type VRStageProps = {
  sceneReady: boolean;
  sceneError: boolean;
  selectedId: AvatarId;
  onSceneElement: (scene: VRSceneElement | null) => void;
};

const chairPositions = [
  '-2.5 0 1.35', '-1.25 0 1.35', '0 0 1.35', '1.25 0 1.35', '2.5 0 1.35',
  '-2.75 0 2.75', '-1.38 0 2.75', '0 0 2.75', '1.38 0 2.75', '2.75 0 2.75',
  '-3 0 4.15', '-1.5 0 4.15', '0 0 4.15', '1.5 0 4.15', '3 0 4.15',
] as const;

const audiencePlacements: ReadonlyArray<{
  avatar: number;
  position: string;
  clip: AudienceClip;
  rotation: number;
  timeScale: number;
}> = [
  { avatar: 0, position: '-2.5 0 1.35', clip: 'SIT_Sitting_Idle1', rotation: 178, timeScale: 0.94 },
  { avatar: 1, position: '-1.25 0 1.35', clip: 'SIT_Sitting2', rotation: 182, timeScale: 0.88 },
  { avatar: 2, position: '1.25 0 1.35', clip: 'SIT_Sitting_Laughing', rotation: 177, timeScale: 0.92 },
  { avatar: 3, position: '2.5 0 1.35', clip: 'SIT_Sitting3', rotation: 184, timeScale: 0.9 },
  { avatar: 2, position: '-2.75 0 2.75', clip: 'SIT_Sitting_Clap', rotation: 181, timeScale: 0.86 },
  { avatar: 0, position: '-1.38 0 2.75', clip: 'SIT_Sitting1', rotation: 176, timeScale: 0.82 },
  { avatar: 3, position: '1.38 0 2.75', clip: 'SIT_Sitting_Idle2', rotation: 183, timeScale: 0.96 },
  { avatar: 1, position: '2.75 0 2.75', clip: 'SIT_Sitting4', rotation: 179, timeScale: 0.72 },
] as const;

const performanceSequence = [
  { clip: 'PERFORM_Talking1', duration: 3800 },
  { clip: 'PERFORM_Agreeing', duration: 4700 },
  { clip: 'PERFORM_Talking2', duration: 5150 },
  { clip: 'PERFORM_Standing_Greeting', duration: 5100 },
  { clip: 'PERFORM_Talking3', duration: 3950 },
  { clip: 'PERFORM_Waving', duration: 3150 },
] as const;

export function VRStage({
  sceneReady,
  sceneError,
  selectedId,
  onSceneElement,
}: VRStageProps) {
  const selectedAvatar = getAvatar(selectedId);
  const [performanceIndex, setPerformanceIndex] = useState(0);
  const performance = performanceSequence[performanceIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPerformanceIndex((index) => (index + 1) % performanceSequence.length);
    }, performance.duration);
    return () => window.clearTimeout(timer);
  }, [performance.duration, performanceIndex]);

  return (
    <div className="scene-card">
      <div className="scene-toolbar" aria-hidden="true">
        <div className="window-dots"><span /><span /><span /></div>
        <span>indoor-theater.aframe</span>
        <span className="live-label">LIVE</span>
      </div>

      <div className="scene-viewport" aria-label="室内脱口秀剧场实时预览">
        {sceneReady ? (
          <a-scene
            ref={(node) => onSceneElement(node as VRSceneElement | null)}
            embedded
            renderer="colorManagement: true; antialias: true; toneMapping: ACESFilmic; exposure: 1.2; physicallyCorrectLights: true"
            vr-mode-ui="enabled: false"
            loading-screen="enabled: false"
            background="color: #15131d"
            webxr="optionalFeatures: bounded-floor, hand-tracking"
          >
            {/* Direct URLs avoid A-Frame resolving React-mounted #asset selectors before they exist. */}
            <a-sky color="#15131d" />
            <a-plane
              position="0 -0.04 -0.6"
              rotation="-90 0 0"
              width="15"
              height="15"
              color="#342c32"
              material="roughness: 1; metalness: 0"
            />

            <a-box position="0 2.5 -6.72" width="15" height="5.1" depth="0.35" color="#211b2b" material="roughness: 0.96; metalness: 0" />
            <a-box position="-7.35 2.5 -0.5" width="0.3" height="5.1" depth="12.8" color="#2c2432" material="roughness: 1; metalness: 0" />
            <a-box position="7.35 2.5 -0.5" width="0.3" height="5.1" depth="12.8" color="#2c2432" material="roughness: 1; metalness: 0" />
            <a-plane position="0 5.02 -0.5" rotation="90 0 0" width="15" height="12.8" color="#18151f" material="side: double; roughness: 1; metalness: 0" />

            <a-box position="0 2.55 -6.48" width="8.3" height="4.3" depth="0.22" color="#2d263b" material="roughness: 0.92; metalness: 0" />
            <a-box position="-3.72 2.52 -6.3" width="0.95" height="4.25" depth="0.18" color="#6f263f" material="roughness: 1; metalness: 0" />
            <a-box position="3.72 2.52 -6.3" width="0.95" height="4.25" depth="0.18" color="#6f263f" material="roughness: 1; metalness: 0" />

            <a-box
              position="0 0.33 -4.8"
              width="8"
              height="0.66"
              depth="3.8"
              color="#6b493f"
              material="roughness: 0.96; metalness: 0"
            />
            <a-entity id="stage-left-stairs">
              <a-box position="-3.15 0.1 -2.05" width="1.45" height="0.2" depth="0.5" color="#6b493f" material="roughness: 0.96; metalness: 0" />
              <a-box position="-3.15 0.2 -2.35" width="1.45" height="0.4" depth="0.5" color="#6b493f" material="roughness: 0.96; metalness: 0" />
              <a-box position="-3.15 0.3 -2.65" width="1.45" height="0.6" depth="0.5" color="#6b493f" material="roughness: 0.96; metalness: 0" />
            </a-entity>
            <a-box
              position="0 3.85 -6.55"
              width="9"
              height="0.35"
              depth="0.6"
              color="#d8b97f"
              material="roughness: 0.9; metalness: 0"
            />
            {[-4.15, 4.15].map((x) => (
              <a-entity key={`column-${x}`} gltf-model="url(/assets/stage/column.glb)" position={`${x} 0.64 -6.2`} scale="1.15 3.2 1.15" />
            ))}
            <a-text value="VR STANDUP" position="0 3.3 -6.2" align="center" width="7" color="#ffe7ad" />
            <a-text value="LIVE COMEDY THEATER" position="0 2.85 -6.18" align="center" width="3.6" color="#d8b97f" />

            <a-entity id="performer" position="0 0.7 -4.55" rotation="0 0 0">
              <a-entity
                key={selectedAvatar.id}
                gltf-model={`url(${selectedAvatar.model})`}
                animation-mixer={`clip: ${performance.clip}; loop: repeat; crossFadeDuration: 0.45`}
              />
            </a-entity>

            <a-cylinder position="0.66 1.24 -3.78" radius="0.035" height="1.15" color="#4e5960" material="metalness: 0.2; roughness: 0.75" />
            <a-sphere position="0.66 1.85 -3.78" radius="0.075" color="#303a40" material="metalness: 0.15; roughness: 0.8" />

            <a-entity gltf-model="url(/assets/stage/stoolBar.glb)" position="1.25 0.66 -4.95" rotation="0 165 0" scale="2 2 2" />
            <a-entity position="-2.9 0 -5.15">
              <a-entity gltf-model="url(/assets/stage/tableRound.glb)" position="-0.485 1.04 0.56" scale="1.4 1.4 1.4" />
              <a-entity gltf-model="url(/assets/stage/plantSmall1.glb)" position="0 1.18 0" scale="1.8 1.8 1.8" />
            </a-entity>
            {[-3.55, 3.4].map((x) => (
              <a-entity key={`speaker-${x}`} gltf-model="url(/assets/stage/speaker.glb)" position={`${x} 0.66 -3.55`} rotation="0 180 0" scale="2.3 2.3 2.3" />
            ))}
            {[-3.72, 3.72].map((x) => (
              <a-entity key={`plant-${x}`} gltf-model="url(/assets/stage/pottedPlant.glb)" position={`${x} 0.66 -5.88`} scale="1.65 1.65 1.65" />
            ))}

            {chairPositions.map((position, index) => (
              <a-entity
                key={`chair-${index}`}
                position={position}
              >
                <a-entity
                  gltf-model={index % 5 === 2 ? 'url(/assets/stage/chair-rounded.glb)' : 'url(/assets/stage/chair.glb)'}
                  position="0.22 0 -0.22"
                  rotation="0 180 0"
                  scale="2.2 2.2 2.2"
                />
              </a-entity>
            ))}
            {audiencePlacements.map((placement, index) => {
              const avatar = AUDIENCE_AVATARS[placement.avatar];
              return (
                <a-entity
                  key={`viewer-${index}`}
                  gltf-model={`url(${avatar.model})`}
                  position={placement.position}
                  rotation={`0 ${placement.rotation} 0`}
                  scale="0.88 0.88 0.88"
                  animation-mixer={`clip: ${placement.clip}; loop: repeat; timeScale: ${placement.timeScale}`}
                />
              );
            })}
            <a-entity light="type: ambient; color: #fff1df; intensity: 1.05" />
            <a-entity light="type: hemisphere; color: #e7efff; groundColor: #6f4b36; intensity: 1.15" />
            <a-entity position="0 3.8 0.3" rotation="-24 0 0" light="type: spot; color: #ffe2bd; intensity: 22; distance: 12; angle: 42; penumbra: 0.78; decay: 1.35" />
            <a-entity position="-4.4 3.2 -2.8" rotation="-18 -68 0" light="type: spot; color: #ffd3c4; intensity: 11; distance: 8; angle: 38; penumbra: 0.82; decay: 1.4" />
            <a-entity position="4.4 3.2 -2.8" rotation="-18 68 0" light="type: spot; color: #cfe3ff; intensity: 10; distance: 8; angle: 38; penumbra: 0.82; decay: 1.4" />
            <a-entity position="0 4.75 -4.45" rotation="-90 0 0" light="type: spot; color: #fff0cf; intensity: 16; distance: 7; angle: 48; penumbra: 0.88; decay: 1.3" />

            <a-entity position="0 1.65 6.1">
              <a-camera look-controls="pointerLockEnabled: false" wasd-controls="acceleration: 18">
                <a-cursor fuse="false" color="#e8c882" />
              </a-camera>
            </a-entity>
          </a-scene>
        ) : (
          <div className="scene-loading" role="status">
            <span className="loader-ring" aria-hidden="true" />
            <p>{sceneError ? '剧场加载失败，请刷新重试。' : '正在搭建室内剧场…'}</p>
          </div>
        )}
      </div>

      <div className="scene-caption">
        <div>
          <span className="caption-kicker">ON STAGE</span>
          <strong>{selectedAvatar.name}</strong>
          <span className="wardrobe-label">动作：{performance.clip.replace('PERFORM_', '')}</span>
        </div>
        <p>室内舞台 · 四向柔光 · 15 把座椅 · 8 位动态观众</p>
      </div>
    </div>
  );
}
