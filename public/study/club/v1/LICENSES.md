# Soft Clay Club 运行素材来源

2026-11-03 用户要求接入已经制作的资产，并在自动检查后上传。本目录为从本机整套候选中明确选用的运行工作副本；原始资料、真人录音/动作、个人授权、模型源件与离线总包仍留在被忽略的 `local_assets/`。

- `models/`：本项目原创、Codex 辅助制作；未导入第三方人物模型。场景含原创家具、程序材质、排字与装饰。样椅沿用已确认版本。公开可访问不表示另行授予模型再分发许可；本项目未擅自指定开放许可。
- `graphics/`：本项目原创花字造型和中文排字，字体为 Noto Sans SC。
- `fonts/NotoSansSC-Variable.ttf`：Google Fonts 原版 Noto Sans SC；作者与版权、SIL OFL 1.1 全文见同目录 `fonts/OFL.txt`。来源：https://github.com/google/fonts/tree/main/ofl/notosanssc 。原字体未修改。
- `audio/working/laugh-soft.wav`、`laugh-short.wav`：裁剪自 SFXMint [crowd-laughter-43](https://sfxmint.com/sounds/crowd-laughter-43)。`laugh-burst.wav` 来自 [crowd-laughter-47](https://sfxmint.com/sounds/crowd-laughter-47)。三份掌声来自 [crowd-applause-59](https://sfxmint.com/sounds/crowd-applause-59)。来源标为 AI 生成、CC0；[许可依据](https://sfxmint.com/license)已随本机源包保留。工作副本裁剪、120毫秒淡入淡出及峰值控制；不是人群实录，未设置研究响度标准。实际播放器目前使用 `laugh-short`，其余供后续内容配置。
- `manifest.json` 逐文件登记字节数及 SHA-256；来源、处理和时长记录在 audio 字段。模型映射保留 draft，公开展示不改变研究审核状态。

源包：`local_assets/collections/soft-clay-club/v1/`。导出脚本仅复制明确白名单，不会将整个源包、生成工具、下载记录或原始声音加入网页。

2026-11-03 Clay v2：六个人物在本机 Blender 重制连续衣物、头面、发型和手掌；沿用本项目原骨架与动作，并重写自然垂手站姿。仍为本项目原创辅助制作，没有引入第三方人物网格。源件与制作命令见 docs/design/AVATAR_SCENE_REVISION.md；原始概念图不嵌入运行模型。
