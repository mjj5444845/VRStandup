# 研究系统代码

目前只有 `spikes/` 中的独立技术检查：三维显示、HTTPS 与头显能力、双端通信、音画同步、视频去背景及测试素材生成。
这些代码不作为正式实验模块直接导入。

正式模块按开发进度建立，尚未创建的目录不放空占位文件：

| 计划目录 | 职责 |
| --- | --- |
| `core/` | 数据类型和纯逻辑规则 |
| `xr/` | Three.js 场景与交互 |
| `web/` | 浏览器通信和录音 |
| `server/` | 实验室服务与日志 |
| `tools/` | 素材处理与场后核查 |
| `config/` | 配置示例，实际分配表仅留本机 |

[当前状态](../docs/project/STATUS.txt) · [开发计划](../docs/project/ROADMAP.md) · [系统设计](../docs/design/SYSTEM_GUIDE.md)

模块依赖和代码规则见根目录 [AGENTS.md](../AGENTS.md)。
