import { AVATARS, getAvatar, type AvatarId } from '../data/avatars';

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

const selectorPositions = [
  '-0.57 1.02 0',
  '0.57 1.02 0',
  '-0.57 0.6 0',
  '0.57 0.6 0',
  '-0.57 0.18 0',
  '0.57 0.18 0',
  '-0.57 -0.24 0',
  '0.57 -0.24 0',
];

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
            ref={(node) => onSceneElement(node as VRSceneElement | null)}
            embedded
            renderer="colorManagement: true; antialias: true; toneMapping: ACESFilmic; exposure: 1.28"
            vr-mode-ui="enabled: false"
            loading-screen="enabled: false"
            background="color: #17141c"
            webxr="optionalFeatures: bounded-floor, hand-tracking"
          >
            <a-assets timeout="15000">
              {AVATARS.flatMap((avatar) => [
                <a-asset-item
                  key={`${avatar.id}-obj`}
                  id={`${avatar.id}-obj`}
                  src={avatar.obj}
                />,
                <a-asset-item
                  key={`${avatar.id}-mtl`}
                  id={`${avatar.id}-mtl`}
                  src={avatar.mtl}
                />,
              ])}
            </a-assets>

            <a-sky color="#17141c" />

            <a-plane
              position="0 0 -2"
              rotation="-90 0 0"
              width="18"
              height="18"
              color="#24212b"
              material="roughness: 0.88; metalness: 0.08"
            />

            <a-box
              position="0 0.35 -4.5"
              width="6.5"
              height="0.7"
              depth="3"
              color="#34273b"
              material="roughness: 0.9; metalness: 0"
            />
            <a-box
              position="0 2.7 -6"
              width="8"
              height="5.4"
              depth="0.25"
              color="#681a38"
              material="roughness: 0.82"
            />

            <a-entity
              key={selectedAvatar.id}
              id="performer"
              position="0 0.72 -4.55"
              rotation="0 0 0"
              scale="0.4 0.4 0.4"
            >
              <a-obj-model
                src={`#${selectedAvatar.id}-obj`}
                mtl={`#${selectedAvatar.id}-mtl`}
              />
            </a-entity>

            <a-cylinder
              position="0.62 1.3 -3.92"
              radius="0.08"
              height="1.2"
              color="#d9c4aa"
              material="metalness: 0.28; roughness: 0.68"
            />
            <a-sphere
              position="0.62 1.94 -3.92"
              radius="0.14"
              color="#f1c15e"
              material="emissive: #8a4c24; emissiveIntensity: 0.12; metalness: 0.2; roughness: 0.62"
            />

            <a-text
              value="VR STANDUP"
              position="0 3.65 -5.8"
              align="center"
              width="7"
              color="#f5ddbf"
              material="emissive: #c85b36; emissiveIntensity: 0.75"
            />
            <a-text
              value={`ON STAGE / ${selectedAvatar.shortLabel}`}
              position="0 3.15 -5.76"
              align="center"
              width="4.2"
              color={selectedAvatar.accent}
            />

            <a-entity position="4.15 1.35 -4.75" rotation="0 -22 0">
              <a-box
                position="0 0.36 -0.08"
                width="2.65"
                height="2.2"
                depth="0.12"
                color="#15131c"
                material="roughness: 0.82; opacity: 0.96"
              />
              <a-text
                value="CHOOSE AVATAR"
                position="0 1.32 0"
                align="center"
                width="2.8"
                color="#ffc46b"
              />
              {AVATARS.map((avatar, index) => {
                const selected = avatar.id === selectedId;
                return (
                  <a-entity key={avatar.id} position={selectorPositions[index]}>
                    <a-box
                      className="avatar-choice"
                      data-avatar-id={avatar.id}
                      width="1"
                      height="0.32"
                      depth="0.1"
                      color={selected ? avatar.accent : '#34303e'}
                      material={`roughness: 0.72; emissive: ${selected ? avatar.accent : '#000000'}; emissiveIntensity: ${selected ? '0.22' : '0'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(avatar.id);
                      }}
                    />
                    <a-text
                      value={`${avatar.shortLabel}  ${avatar.id.replace('-', ' ').toUpperCase()}`}
                      position="0 0 0.065"
                      align="center"
                      width="1.72"
                      color={selected ? '#130d14' : '#eee4dc'}
                    />
                  </a-entity>
                );
              })}
              <a-text
                value="POINT + TRIGGER"
                position="0 -0.62 0"
                align="center"
                width="2.1"
                color="#8e8492"
              />
            </a-entity>

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

            <a-entity light="type: ambient; color: #fff4e8; intensity: 1.18" />
            <a-entity
              position="-2.4 4.8 0.2"
              light="type: spot; color: #ffe9cf; intensity: 6; angle: 58; penumbra: 1; distance: 14; decay: 1.2; target: #performer"
            />
            <a-entity
              position="-4 3 -2.5"
              light="type: point; color: #ff91aa; intensity: 1.8; distance: 11; decay: 1.5"
            />
            <a-entity
              position="4 3 -2.5"
              light="type: point; color: #9eabff; intensity: 1.6; distance: 11; decay: 1.5"
            />
            <a-entity
              position="2.8 3.2 1.5"
              light="type: spot; color: #fff8ee; intensity: 4.2; angle: 68; penumbra: 1; distance: 13; decay: 1.2; target: #performer"
            />
            <a-entity
              position="0 5 -5.2"
              light="type: point; color: #ffd7b0; intensity: 1.25; distance: 8; decay: 1.6"
            />

            <a-entity position="0 1.65 2.8">
              <a-camera
                look-controls="pointerLockEnabled: false"
                wasd-controls="acceleration: 18"
              >
                <a-cursor
                  fuse="false"
                  raycaster="objects: .avatar-choice"
                  color="#ffc46b"
                />
              </a-camera>
            </a-entity>
            <a-entity
              laser-controls="hand: right"
              raycaster="objects: .avatar-choice; far: 12"
              line="color: #ffc46b; opacity: 0.9"
            />
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
          <span className="caption-kicker">ON STAGE</span>
          <strong>{selectedAvatar.name}</strong>
          <span className="wardrobe-label">{selectedAvatar.wardrobe}</span>
        </div>
        <p>拖动视角 · WASD 移动 · 指向选角台切换演员</p>
      </div>
    </div>
  );
}
