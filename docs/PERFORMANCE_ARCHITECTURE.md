# VR Standup 表演系统规划

## 当前完成的边界

- `app/data/avatars.ts` 是 8 位演员的唯一角色目录，统一维护模型、显示名称与声线方向。
- `app/components/vr-stage.tsx` 只负责 WebXR 舞台、演员模型和 VR 内选角台。
- `app/components/avatar-selector.tsx` 提供浏览器与移动端的无障碍选角界面。
- `app/lib/performance/types.ts` 定义脚本、台词段落、声线绑定、TTS 结果与表演清单。
- `public/avatars/` 只保存上线所需的 8 个平滑版 OBJ、MTL 和 CC0 授权文件；源压缩包留在本地。

## 下一阶段的数据流

```text
脚本导入
  -> 按角色拆分 PerformanceCue
  -> 校验 avatarId 与台词顺序
  -> 为每个角色绑定 VoiceBinding
  -> TtsProvider 批量生成音频
  -> 保存音频 URL、时长和停顿信息
  -> 生成 PerformanceManifest
  -> VR 播放器按 cue 顺序驱动音频、口型、动作、灯光和字幕
```

## 建议新增模块

```text
app/api/tts/route.ts                  服务端 TTS 入口，隐藏供应商密钥
app/api/performances/route.ts         保存与读取演出清单
app/lib/performance/parser.ts         把后续提供的脚本转换为 cue
app/lib/performance/validator.ts      校验角色、顺序、空台词与声线绑定
app/lib/tts/<provider>.ts             各 TTS 服务商适配器
app/components/performance-player.tsx 音频与场景时间线播放器
public/performances/<show-id>/        本地研究阶段的音频与 manifest
```

## TTS 选型时需要确定

1. 中文、英文或双语，以及是否需要方言。
2. 是否允许声音克隆；如允许，必须记录每个声音样本的授权与使用范围。
3. 实时生成还是演出前批量生成。脱口秀建议优先批量生成，保证 VR 播放时延和节奏稳定。
4. 音频存储位置。本地研究可放在 `public/performances/`，正式环境建议使用对象存储/CDN。
5. 是否需要逐词时间戳。后续若做口型、字幕和动作同步，应选择能返回时间戳的服务。

当前角色卡中的“声线方向”只是创作占位，不绑定任何具体供应商或真实人物声音。
