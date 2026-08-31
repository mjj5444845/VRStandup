import {
  AUDIENCE_AVATARS,
  AVATARS,
  getAvatar,
  type AvatarId,
} from '../data/avatars';

type VRSceneElement = HTMLElement & {
  enterVR?: () => Promise<void>;
};

type VRStageProps = {
  sceneReady: boolean;
  sceneError: boolean;
  selectedId: AvatarId;
  onSelect: (id: AvatarId) => void;
  onSceneElement: (scene: VRSceneElement | null) => void;
};

const chairPositions = [
  '-3.2 0 1.8', '-1.6 0 1.8', '0 0 1.8', '1.6 0 1.8', '3.2 0 1.8',
  '-3.6 0 3.25', '-1.8 0 3.25', '0 0 3.25', '1.8 0 3.25', '3.6 0 3.25',
  '-4 0 4.7', '-2 0 4.7', '0 0 4.7', '2 0 4.7', '4 0 4.7',
] as const;

const audiencePlacements = [
  { avatar: 0, position: '-3.2 0.05 1.78' },
  { avatar: 1, position: '-1.6 0.05 1.78' },
  { avatar: 2, position: '1.6 0.05 1.78' },
  { avatar: 3, position: '3.2 0.05 1.78' },
  { avatar: 2, position: '-3.6 0.05 3.23' },
  { avatar: 0, position: '-1.8 0.05 3.23' },
  { avatar: 3, position: '1.8 0.05 3.23' },
  { avatar: 1, position: '3.6 0.05 3.23' },
] as const;

export function VRStage({
  sceneReady,
  sceneError,
  selectedId,
  onSelect,
  onSceneElement,
}: VRStageProps) {
  const selectedAvatar = getAvatar(selectedId);

  return (
    <div className="scene-card">
      <div className="scene-toolbar" aria-hidden="true">
        <div className="window-dots"><span /><span /><span /></div>
        <span>outdoor-stage.aframe</span>
        <span className="live-label">LIVE</span>
      </div>

      <div className="scene-viewport" aria-label="晴天露天脱口秀舞台实时预览">
        {sceneReady ? (
          <a-scene
            ref={(node) => onSceneElement(node as VRSceneElement | null)}
            embedded
            renderer="colorManagement: true; antialias: true; toneMapping: ACESFilmic; exposure: 1.05; physicallyCorrectLights: true"
            vr-mode-ui="enabled: false"
            loading-screen="enabled: false"
            background="color: #8fd4ff"
            webxr="optionalFeatures: bounded-floor, hand-tracking"
          >
            <a-assets timeout="30000">
              {AVATARS.map((avatar) => (
                <a-asset-item key={avatar.id} id={`${avatar.id}-model`} src={avatar.model} />
              ))}
              {AUDIENCE_AVATARS.map((avatar) => (
                <a-asset-item key={avatar.id} id={avatar.id} src={avatar.model} />
              ))}
              <a-asset-item id="stage-chair" src="/assets/stage/chair.glb" />
              <a-asset-item id="stage-chair-rounded" src="/assets/stage/chair-rounded.glb" />
              <a-asset-item id="stage-floor" src="/assets/stage/floor-thick.glb" />
              <a-asset-item id="stage-column" src="/assets/stage/column.glb" />
              <a-asset-item id="stage-stairs" src="/assets/stage/stairs.glb" />
            </a-assets>

            <a-sky color="#8fd4ff" />
            <a-plane
              position="0 -0.04 -1"
              rotation="-90 0 0"
              width="28"
              height="28"
              color="#8dbd6c"
              material="roughness: 1; metalness: 0"
            />

            <a-box
              position="0 0.32 -4.8"
              width="8"
              height="0.64"
              depth="3.8"
              color="#d8c7aa"
              material="roughness: 0.96; metalness: 0"
            />
            {[-3, -1, 1, 3].map((x) => (
              <a-entity key={`floor-${x}`} gltf-model="#stage-floor" position={`${x} 0.65 -4.8`} scale="2 0.5 2" />
            ))}
            <a-entity gltf-model="#stage-stairs" position="0 0 -2.72" rotation="0 180 0" scale="1.5 0.7 1.2" />
            <a-box
              position="0 3.85 -6.55"
              width="9"
              height="0.35"
              depth="0.6"
              color="#f0e4cf"
              material="roughness: 0.9; metalness: 0"
            />
            {[-4.15, 4.15].map((x) => (
              <a-entity key={`column-${x}`} gltf-model="#stage-column" position={`${x} 0.64 -6.2`} scale="1.15 3.2 1.15" />
            ))}
            <a-text value="VR STANDUP" position="0 3.28 -6.23" align="center" width="7" color="#17314a" />
            <a-text value="OPEN AIR COMEDY" position="0 2.84 -6.2" align="center" width="3.6" color="#376581" />

            <a-entity
              key={selectedAvatar.id}
              id="performer"
              gltf-model={`#${selectedAvatar.id}-model`}
              position="0 0.66 -4.55"
              rotation="0 180 0"
              animation-mixer="clip: PERFORM_Talking1; loop: repeat; crossFadeDuration: 0.3"
            />

            <a-cylinder position="0.66 1.24 -3.78" radius="0.035" height="1.15" color="#4e5960" material="metalness: 0.2; roughness: 0.75" />
            <a-sphere position="0.66 1.85 -3.78" radius="0.075" color="#303a40" material="metalness: 0.15; roughness: 0.8" />

            {chairPositions.map((position, index) => (
              <a-entity
                key={`chair-${index}`}
                gltf-model={index % 5 === 2 ? '#stage-chair-rounded' : '#stage-chair'}
                position={position}
                rotation="0 0 0"
                scale="0.9 0.9 0.9"
              />
            ))}
            {audiencePlacements.map((placement, index) => {
              const avatar = AUDIENCE_AVATARS[placement.avatar];
              return (
                <a-entity
                  key={`viewer-${index}`}
                  gltf-model={`#${avatar.id}`}
                  position={placement.position}
                  rotation="0 0 0"
                  scale="0.96 0.96 0.96"
                  animation-mixer={`clip: ${avatar.clip}; loop: repeat; timeScale: ${index % 2 ? '0.92' : '1.04'}`}
                />
              );
            })}

            <a-entity position="4.6 1.45 -3.8" rotation="0 -24 0">
              <a-box width="2.55" height="1.7" depth="0.12" color="#f8f3e7" material="roughness: 0.98; metalness: 0" />
              <a-text value="CHOOSE PERFORMER" position="0 0.58 0.075" align="center" width="2.6" color="#17314a" />
              {AVATARS.map((avatar, index) => {
                const selected = avatar.id === selectedId;
                return (
                  <a-entity key={avatar.id} position={`0 ${0.13 - index * 0.48} 0`}>
                    <a-box
                      className="avatar-choice"
                      data-avatar-id={avatar.id}
                      width="2.05"
                      height="0.34"
                      depth="0.1"
                      color={selected ? avatar.accent : '#dce8eb'}
                      material={`roughness: 0.92; metalness: 0; emissive: ${selected ? avatar.accent : '#000000'}; emissiveIntensity: ${selected ? '0.05' : '0'}`}
                      onClick={(event) => { event.stopPropagation(); onSelect(avatar.id); }}
                    />
                    <a-text value={`${avatar.shortLabel}  ${avatar.gender.toUpperCase()}`} position="0 0 0.065" align="center" width="2.6" color="#17314a" />
                  </a-entity>
                );
              })}
              <a-text value="POINT + TRIGGER / VOICE PREVIEW" position="0 -0.67 0.075" align="center" width="2.25" color="#5e7480" />
            </a-entity>

            <a-entity light="type: ambient; color: #dff3ff; intensity: 1.25" />
            <a-entity position="-5 9 4" light="type: directional; color: #fff4d6; intensity: 2.15" />
            <a-entity position="5 5 1" light="type: directional; color: #d7eeff; intensity: 0.72" />

            <a-entity position="0 1.65 6.1">
              <a-camera look-controls="pointerLockEnabled: false" wasd-controls="acceleration: 18">
                <a-cursor fuse="false" raycaster="objects: .avatar-choice" color="#17314a" />
              </a-camera>
            </a-entity>
            <a-entity laser-controls="hand: right" raycaster="objects: .avatar-choice; far: 14" line="color: #17314a; opacity: 0.9" />
          </a-scene>
        ) : (
          <div className="scene-loading" role="status">
            <span className="loader-ring" aria-hidden="true" />
            <p>{sceneError ? '剧场加载失败，请刷新重试。' : '正在搭建露天舞台…'}</p>
          </div>
        )}
      </div>

      <div className="scene-caption">
        <div>
          <span className="caption-kicker">ON STAGE</span>
          <strong>{selectedAvatar.name}</strong>
          <span className="wardrobe-label">点击角色可试听语音</span>
        </div>
        <p>晴天柔光 · 15 把座椅 · 8 位虚拟观众</p>
      </div>
    </div>
  );
}
