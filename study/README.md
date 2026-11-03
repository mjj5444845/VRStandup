# 研究系统代码

已实现至 M4 的正式软件：`core/` 规则/格式/时间线/会话、`web/` 录音与可靠客户端、`xr/` 录制/复查/节点映射、`storage/` 私密库与日志、`server/` 页面/消息/会话服务、`tools/` 素材整理及校验。
`spikes/` 保留早期显示、连接、通信、同步、录制与回放等独立检查。
`spikes/` 代码不作为正式实验模块直接导入。

正式模块按开发进度建立，尚未创建的目录不放空占位文件：

| 计划目录 | 职责 |
| --- | --- |
| `core/` | 数据类型和纯逻辑规则 |
| `xr/` | Three.js 场景与交互 |
| `web/` | 浏览器通信和录音 |
| `storage/` | 仅 Node 的私密文件、校验和持久日志，供服务/离线工具共用 |
| `server/` | 实验室服务与日志 |
| `tools/` | 素材处理与场后核查 |
| `config/` | 配置示例，实际分配表仅留本机 |

[当前状态](../docs/project/STATUS.txt) · [开发计划](../docs/project/ROADMAP.md) · [系统设计](../docs/design/SYSTEM_GUIDE.md)

模块依赖和代码规则见根目录 [AGENTS.md](../AGENTS.md)。
`npm run check:boundaries` 自动检查导入方向，已包含在统一检查中；实现和测试放在 `scripts/architecture/`，不属于实验系统运行代码。
