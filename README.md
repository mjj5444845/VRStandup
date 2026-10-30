# PunchCap

基于 Three.js 与 WebXR 的虚拟脱口秀研究系统。演员提前录制动作和声音，由三维虚拟演员在剧场中回放；参与者在头显中从自己的座位观看并与花字互动，实验员通过网页控制台管理流程和记录数据。

首页为开发进度看板，展示各阶段任务、所属模块、当前状态、用途与完成标准，支持搜索和筛选。项目正在重构，目前提供三维动作回放、三维显示、头显连接、双端通信、音画同步和视频去背景检查页面。视频检查保留为技术参考；真实演员录制回放、正式剧场与完整实验流程仍在开发。开发环境为 macOS，目标运行环境为 Windows 11 实验室电脑，无需依赖 Vercel。

## 本地启动

安装 `.nvmrc` 指定的 Node.js 版本，在项目根目录执行：

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

打开 [本地首页](http://127.0.0.1:3000)。Windows PowerShell 中将 `npm` 替换为 `npm.cmd`。
完整安装步骤见 [Mac 指南](docs/guides/01-Mac开发与运行.txt) 和 [Windows 11 指南](docs/guides/03-Windows11安装与运行.txt)。

双端通信及音画同步使用独立检查服务：

```sh
npm run build
npm run spike:net
```

打开 [开发进度看板](http://127.0.0.1:3001/)、[三维动作回放](http://127.0.0.1:3001/spike/replay)、[通信检查](http://127.0.0.1:3001/spike/network)、[音画同步检查](http://127.0.0.1:3001/spike/media) 或 [视频去背景检查](http://127.0.0.1:3001/spike/chroma)。头显连接需使用 HTTPS，配置方法见 [头显连接指南](docs/guides/05-第二个工作-HTTPS与头显连接.txt)。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `app/` | 网页入口、界面与样式 |
| `scripts/` | 项目检查工具，目前为模块边界检查 |
| `study/` | 研究系统代码，目前为独立技术检查 |
| `public/study/` | 网页使用的公开素材及来源登记 |
| `docs/` | 运行指南、系统设计、开发进度与研究问卷 |
| `local_assets/` | 本机原始素材、场景参考包及工具，不随 Git 上传 |
| `archive/` | 保留原样的旧版工程 |

检查项目使用 `npm run check`，生产构建使用 `npm run build`。
仅检查代码分层使用 `npm run check:boundaries`，操作与错误示例见 [模块边界检查说明](docs/guides/10-第七个工作-模块边界检查.txt)。
实验数据、本机证书、密码与临时输出不进入 Git；文件保存范围见 [环境与上传规则](docs/guides/SETUP.md)。

## 文档

- [文档目录](docs/README.md)：按用途查找操作说明和设计资料。
- [任务清单](docs/project/tasks.json)（首页数据来源） · [当前状态](docs/project/STATUS.txt) · [开发计划](docs/project/ROADMAP.md) · [检查记录](docs/project/VALIDATION.md)
- [系统设计](docs/design/SYSTEM_GUIDE.md) · [演员录制与回放](docs/design/PERFORMER_RECORDING.md) · [剧场建模参考](docs/design/SCENE_REFERENCE.md)
