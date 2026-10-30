# PunchCap

使用 **Three.js** 建设的虚拟脱口秀研究系统。**Mac 开发，Windows 11 实验室电脑运行**。
旧版保存在 `archive/`，新版从独立代码、舞台和视觉方案开始。

## 新手从这里开始

先看 [阅读顺序与当前状态](docs/study/00-阅读顺序与当前状态.txt)，然后按顺序操作：

1. [Mac 开发与运行](docs/study/01-Mac开发与运行.txt)
2. [Mac 到 Windows 传文件](docs/study/02-Mac到Windows传文件.txt)
3. [Windows 11 安装与运行](docs/study/03-Windows11安装与运行.txt)
4. [第一个工作：三维显示检查](docs/study/04-第一个工作-三维显示检查.txt)
5. [第二个工作：HTTPS 与头显连接](docs/study/05-第二个工作-HTTPS与头显连接.txt)
6. [第三个工作：两个网页传消息](docs/study/06-第三个工作-两个网页传消息.txt)
7. [第四个工作：声音与视频同步](docs/study/07-第四个工作-声音与视频同步.txt)

以上 `.txt` 文件可用记事本打开。每次完成一个步骤再继续。

## 项目现在能做什么

已有三个基础页面：`/`、`/study`、`/lab`，以及独立的 `/spike` 三维显示检查页。
检查页显示 Three.js 方块，支持暂停、继续和重新加载；`/spike/xr` 检查安全连接与 VR 能力。
已提供独立 HTTPS 检查服务和证书准备脚本；正式舞台尚未制作。
`/spike/network` 可打开实验员端与参与者端，检查消息收发。先构建，再用 `npm run spike:net`
启动，打开 `http://127.0.0.1:3001/spike/network`；这一步只供当前电脑访问，不需要证书或头显。
同一服务的 `/spike/media` 使用原创计时画面和节拍声，连续检查 60 秒音画偏差，并下载原始记录。
Mac 上检查和构建已通过；Windows 与头显尚待实际验证。完整进度只在上面的状态文件维护。

Three.js 负责三维画面；Next.js 负责承载网页和控制台。
Node.js 让项目在电脑运行，npm 安装工具包，Git 保存修改历史。部署不依赖 Vercel。

## 在当前 Mac 上打开网页

先在终端进入项目目录：

```sh
cd "/Users/jeffrey/Desktop/VRStandup"
```

当前已安装好工具包，启动时执行：

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

浏览器打开 `http://localhost:3000`。停止时在启动窗口按 `Control + C`。
首次取得项目或版本清单变化时，先按 Mac 专用说明安装工具包。
Windows 的路径和命令请用 Windows 专用说明，不直接照搬本段。

## 文件放在哪里

| 位置 | 用途 |
| --- | --- |
| `app/` | 网页入口、参与者端、实验员端与样式 |
| `study/` | 按模块建立的数据规则、三维场景、通信、实验服务与工具 |
| `public/study/` | 已选定且允许公开的正式素材 |
| `local_assets/` | 本机原始素材，说明文件之外不上传 GitHub |
| `docs/study/` | 操作说明、技术设计、计划和历史记录 |
| `archive/` | 旧版历史资料，不由新版加载 |
| `data/`、`certs/` | 后续实验数据和本机证书，不能上传 GitHub |

## 其他说明

- [环境与上传规则](docs/study/SETUP.md)：了解工具和文件保存范围。
- [模块推进计划](docs/study/RESTART_PLAN.md)：查看后续分工和依赖。
- [完整技术指南](docs/study/SYSTEM_GUIDE.md)：实现各模块时再读对应部分。
- [助手工作规则](AGENTS.md)：助手在本项目如何开展工作。
- [变更记录](docs/study/CHANGELOG.md)：查看过去做过哪些修改。

运行命令以 `package.json` 为准。尚未实现的 `lab` 等实验命令不属于当前启动步骤。
原始指南、旧素材和旧系统的文件仍在归档中；不上传 GitHub 的资料需要另外备份。
