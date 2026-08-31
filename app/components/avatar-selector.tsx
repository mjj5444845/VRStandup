import { AVATARS, type AvatarId } from '../data/avatars';

type AvatarSelectorProps = {
  selectedId: AvatarId;
  onSelect: (id: AvatarId) => void;
};

export function AvatarSelector({ selectedId, onSelect }: AvatarSelectorProps) {
  return (
    <section className="avatar-lab" id="avatars" aria-labelledby="avatars-title">
      <div className="avatar-lab-heading">
        <div>
          <p className="eyebrow">CASTING CONSOLE · 8 AVATARS</p>
          <h2 id="avatars-title">选一位今晚的演员。</h2>
        </div>
        <p>
          点击角色可立即替换舞台演员。进入 VR 后，也可以用右手柄射线或视线光标操作舞台右侧的选角台。
        </p>
      </div>

      <div className="avatar-grid" role="list" aria-label="可选演员">
        {AVATARS.map((avatar) => {
          const selected = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              className={`avatar-option${selected ? ' is-selected' : ''}`}
              type="button"
              onClick={() => onSelect(avatar.id)}
              aria-pressed={selected}
              style={{ '--avatar-accent': avatar.accent } as React.CSSProperties}
            >
              <span className="avatar-code">{avatar.shortLabel}</span>
              <span className="avatar-option-copy">
                <strong>{avatar.name}</strong>
                <small>{avatar.wardrobe}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
