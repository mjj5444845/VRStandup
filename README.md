# PunchCap

基于 Three.js 与 WebXR 的虚拟脱口秀研究系统。参与者在头显中观看表演并与花字互动，实验员通过网页控制台管理流程和记录数据。

项目正在重构，目前提供三维显示、头显连接、双端通信、音画同步和视频去背景检查页面。正式剧场与完整实验流程仍在开发。开发环境为 macOS，目标运行环境为 Windows 11 实验室电脑，无需依赖 Vercel。

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

打开 [通信检查](http://127.0.0.1:3001/spike/network)、[音画同步检查](http://127.0.0.1:3001/spike/media) 或 [视频去背景检查](http://127.0.0.1:3001/spike/chroma)。头显连接需使用 HTTPS，配置方法见 [头显连接指南](docs/guides/05-第二个工作-HTTPS与头显连接.txt)。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `app/` | 网页入口、界面与样式 |
| `study/` | 研究系统代码，目前为独立技术检查 |
| `public/study/` | 网页使用的公开素材及来源登记 |
| `docs/` | 运行指南、系统设计、开发进度与研究问卷 |
| `local_assets/` | 本机原始素材、场景参考包及工具，不随 Git 上传 |
| `archive/` | 保留原样的旧版工程 |

检查项目使用 `npm run check`，生产构建使用 `npm run build`。
实验数据、本机证书、密码与临时输出不进入 Git；文件保存范围见 [环境与上传规则](docs/guides/SETUP.md)。

## 文档

- [文档目录](docs/README.md)：按用途查找操作说明和设计资料。
- [当前状态](docs/project/STATUS.txt) · [开发计划](docs/project/ROADMAP.md) · [检查记录](docs/project/VALIDATION.md)
- [系统设计](docs/design/SYSTEM_GUIDE.md) · [剧场建模参考](docs/design/SCENE_REFERENCE.md)
