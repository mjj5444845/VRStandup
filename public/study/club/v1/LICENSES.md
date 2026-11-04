# Soft Clay Club 运行素材来源

2026-11-03 用户要求接入已经制作的资产，并在自动检查后上传。本目录为从本机整套候选中明确选用的运行工作副本；原始资料、真人录音/动作、个人授权、模型源件与离线总包仍留在被忽略的 `local_assets/`。

- `models/scene-empty.glb`：本项目制作的家具、布局、程序材质、排字与装饰；样椅沿用已确认版本。2026-11-04新增两张内置imagegen生成的原创暖色插画，作为六幅墙画嵌入。
- `models/actor.glb` 与 `audience-01..05.glb`（2026-11-04 v3）：按用户要求改编旧项目已保存的Adobe Mixamo人物。演员Ch23，观众依次Ch07/Ch31/Ch21/Ch23/Ch02；说话/解释/挥手等动作由旧Ch06动作重定向，坐姿按当前椅子修正。保留原人体网格、脸部/头发纹理与蒙皮，修改材质、尺度、坐标系和动作。来源为 `archive/legacy-2026-10-30/project/public/avatars/active/` 的只读副本。运行时只读取本目录。
- Mixamo人物和动作遵循Adobe条款，不是本项目从零原创，不标为CC0。[Adobe官方FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)说明可以免版税用于个人、商业和非营利项目。这里作为系统的嵌入资源使用，不提供单独素材包或授予再分发权；编辑源件留在本机。
- `graphics/`：本项目原创花字造型和中文排字，字体为 Noto Sans SC。
- `fonts/NotoSansSC-Variable.ttf`：Google Fonts 原版 Noto Sans SC；作者与版权、SIL OFL 1.1 全文见同目录 `fonts/OFL.txt`。来源：https://github.com/google/fonts/tree/main/ofl/notosanssc 。原字体未修改。
- `audio/working/laugh-soft.wav`、`laugh-short.wav`：裁剪自 SFXMint [crowd-laughter-43](https://sfxmint.com/sounds/crowd-laughter-43)。`laugh-burst.wav` 来自 [crowd-laughter-47](https://sfxmint.com/sounds/crowd-laughter-47)。三份掌声来自 [crowd-applause-59](https://sfxmint.com/sounds/crowd-applause-59)。来源标为 AI 生成、CC0；[许可依据](https://sfxmint.com/license)已随本机源包保留。工作副本裁剪、120毫秒淡入淡出及峰值控制；不是人群实录，未设置研究响度标准。实际播放器目前使用 `laugh-short`，其余供后续内容配置。
- `manifest.json` 逐文件登记字节数及 SHA-256；来源、处理和时长记录在 audio 字段。模型映射保留 draft，公开展示不改变研究审核状态。

源包：`local_assets/collections/soft-clay-club/v1/`。导出脚本仅复制明确白名单，不会将整个源包、生成工具、下载记录或原始声音加入网页。

历史：2026-11-03 Clay v2是本项目制作的连续曲面人物；用户后续否决其外观，2026-11-04已由上述Mixamo改编人物替换。因此旧版“没有第三方人体”的描述不适用于当前人物文件。源件与制作命令见 docs/design/AVATAR_SCENE_REVISION.md。

2026-11-04场景精修：新增平台、踏步、边缘条与舞台前沿由本项目 `scripts/art/polish-club.py` 在Blender生成，合入既有场景；既有第三方人物、纹理、音频条款不变。网上VR作品仅作为设计参考，没有复制其资产。新副本路径 `local_assets/models/scene-polish-v4/`，不是历史原始源包。
