# 研究系统模块

本目录用于建立新版研究代码，不引用旧归档。

| 子目录 | 用途 |
| --- | --- |
| `core/` | 数据类型和可独立检查的业务规则 |
| `xr/` | Three.js 场景、播放与交互 |
| `web/` | 浏览器通信和录音 |
| `server/` | Windows 11 实验室服务 |
| `tools/` | 素材处理与场后核查 |
| `config/` | 示例配置；实际分配表不进入 Git |
| `spikes/` | 独立技术验证；基础方块、HTTPS、证书、VR、通信、音画同步与测试素材生成 |

正式模块的目录已经预留，具体功能尚未实现；`spikes/` 的验证代码不由正式模块导入。
当前状态见 `docs/study/00-阅读顺序与当前状态.txt`。
开发顺序见 `docs/study/RESTART_PLAN.md`，技术细节见 `docs/study/SYSTEM_GUIDE.md`。
工作规则只维护在根目录 `AGENTS.md`。
