# VR Standup 表演系统规划

## 当前完成的边界

- `app/data/avatars.ts` 是 8 位演员的唯一角色目录，统一维护模型、显示名称与声线方向。
- `app/components/vr-stage.tsx` 只负责 WebXR 舞台、演员模型和 VR 内选角台。
- `app/components/avatar-selector.tsx` 提供浏览器与移动端的无障碍选角界面。
- `app/lib/performance/types.ts` 定义脚本、台词段落、声线绑定、TTS 结果与表演清单。
- `app/api/tts/` 在服务端调用 Mosi，浏览器无法读取 `MOSS_API_KEY`。
- `app/voices/` 提供 Voice ID 选择、演员绑定和 MP3 试听。
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
app/api/tts/voices/route.ts           查询当前 Mosi 账户可用 Voice ID
app/api/tts/speech/route.ts           服务端 Mosi TTS 入口，隐藏供应商密钥
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
3. 当前采用 Mosi `moss-tts-1.5-flash` 与 `POST /v1/audio/speech`；音色以 Voice ID 绑定。
4. 脱口秀正式演出建议提前批量生成，保证 VR 播放时延和节奏稳定。
5. 音频存储位置。本地研究可放在 `public/performances/`，正式环境建议使用对象存储/CDN。
6. 是否需要逐词时间戳。后续若做口型、字幕和动作同步，需要增加时间戳或对齐服务。

## 密钥与线上安全

- 本地密钥只写入被 Git 忽略的 `.env.local`。
- 线上密钥只配置为部署平台加密环境变量 `MOSS_API_KEY`。
- 客户端只访问 `/api/tts/voices` 与 `/api/tts/speech`，服务端才添加 Bearer 认证头。
- 试听接口限制为每个来源每分钟 6 次、单次最多 500 字符，并清洗上游错误。
- 当前限流适合私有研究部署；若未来公开访问，应增加登录、持久化额度或验证码保护。

当前角色卡中的“声线方向”只是创作占位，不绑定任何具体供应商或真实人物声音。
