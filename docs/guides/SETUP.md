# 环境与上传规则

本文件解释“为什么这样设置”。实际操作见 [Mac 说明](01-Mac开发与运行.txt)、
[传文件说明](02-Mac到Windows传文件.txt)、[Windows 说明](03-Windows11安装与运行.txt)。
当前进度统一见 [阅读顺序与当前状态](../project/STATUS.txt)。

## 工具各做什么

| 工具 | 用途 | 当前约定 |
| --- | --- | --- |
| Node.js | 让项目运行，叫“运行环境” | 本机验证版本 22.22.1，记录在 `.nvmrc` |
| npm | 安装项目需要的工具包，叫“包管理器” | Mac 已检查版本 10.9.4；Windows 随 Node.js 安装 |
| Git | 保存修改历史，叫“版本控制” | Mac 已安装；Windows 手动传文件时可暂不安装 |
| Three.js | 画三维场景并处理交互，叫“三维渲染库” | 已安装，准确版本见 `package.json` |
| Next.js | 承载网页入口和实验员控制台，叫“网页框架” | 同一份源码供 Mac 与 Windows 使用 |
| tsx | 执行 TypeScript 编写的小工具 | 已固定在项目版本清单，随依赖安装 |
| ws | 在服务端传递 WebSocket 消息 | S2 已使用；浏览器使用自带的 WebSocket |

FFmpeg 是处理视频的工具，目前已在 Mac 的 `local_assets/tools/ffmpeg` 准备本机副本，
仅用于生成 S3 同步及 S4 去背景原创测试素材；日常运行与 Windows 播放现成素材不需要它。
该工具来自 PyPI 的 imageio-ffmpeg 0.6.0 固定版本包，包的 SHA-256 下载后已经核对；
二进制不上传，也未安装到全局路径。重新生成操作见 [第四步说明](07-第四个工作-声音与视频同步.txt)。
mkcert 尚未安装，它为 HTTPS 准备本机证书，操作见 [第二步说明](05-第二个工作-HTTPS与头显连接.txt)。
HTTPS 检查服务已经实现；本次只用临时测试证书验证，没有更改系统信任或防火墙。
不需要证书的本机消息检查见 [第三步说明](06-第三个工作-两个网页传消息.txt)。
2026-10-30 的依赖检查发现原 Next.js 版本的已知安全问题，已更新到 16.4.3，
对应 eslint-config-next 同步更新；兼容范围内间接依赖更新后，安装审计报告为 0 项。
这只是该日期的依赖检查结果，不能代替后续更新和设备验收。

## 版本和平台

- `.nvmrc` 是版本记录，本身不会安装或切换 Node.js。
- `.npmrc` 要求新增工具包记录准确版本，并检查 Node.js 是否满足项目要求。
- `package.json` 记录工具包和可执行命令；`package-lock.json` 记录完整版本清单。
- 两台电脑共用源码和版本清单；`node_modules/` 和 `.next/` 在各自电脑重新生成。
- `.gitattributes` 约定新文本的换行方式，旧归档保留原始字节。
- Mac 用终端和 `npm`；Windows 用 PowerShell 和 `npm.cmd`。路径与命令分别写在专用说明里。

## 上传与部署

“推送”是把代码保存到 GitHub；“部署”是把程序放到运行电脑上。
当前目标是 Windows 11 实验室电脑，不依赖 Vercel。
仓库在 2026-10-30 检查时是公开仓库，准备上传的内容要允许他人看到。

| 内容 | 存放位置 | 保存到 GitHub |
| --- | --- | --- |
| 新代码、项目说明、无私密信息的配置 | `app/`、`study/`、`docs/` 和根目录配置 | 可以 |
| 已选定并允许公开的正式素材 | `public/study/` | 可以，浏览器也可能直接取得 |
| 本项目新生成的同步检查画面与声音 | `public/study/checks/media-clock/` | 可以，来源与校验值已登记 |
| 旧代码和可公开的小型运行素材 | `archive/legacy-2026-10-30/project/` | 可以，下列原始资料除外 |
| 原始录像、截图和旧输出 | 归档中的 `standup_video/`、`videoshortcutpic/`、`output/` 等 | 不上传 |
| 新原始素材 | `local_assets/` | 不上传，说明文件除外 |
| 参与者记录、答案和录音 | `data/sessions/` | 不上传 |
| 实际分配表 | `study/config/allocation.json` | 不上传 |
| 密码、密钥、本机证书 | `.env.local`、`certs/` 等 | 不上传 |
| 下载的工具包、生成结果、缓存和日志 | `node_modules/`、`.next/`、`output/` 等 | 不上传 |

小型素材不是按大小自动识别的；原始资料主要按文件夹排除。选用新素材时核对用途、许可与体积。
`public/` 是“公开展示柜”，原始资料和私密内容不要放入其中。

## 规则写在哪里

- `.gitignore`：让 Git 忽略不应记录的新文件。它不会撤回已经上传的文件，所以推送前仍要核对清单。
- `.vercelignore`：保留的可选 Vercel 命令行排除规则；Windows 实验室运行不使用它。
- `vercel.json`：保留的可选 Vercel 配置；不决定本机启动方式。
- `tsconfig.json`、`eslint.config.mjs`：让新版检查跳过旧归档，不是上传控制工具。

如果以后选择 Vercel，命令行上传与从 GitHub 自动取源码是不同流程，不能只靠 `.vercelignore`
保护保密资料。私密内容从一开始就不进入 GitHub。

## 备份

“不上传”与“有备份”是两件事。原始视频、录音和实验数据需要单独备份。
当前独立备份状态见 `docs/project/STATUS.txt`。

## 参考

- [Node.js 固定版本](https://nodejs.org/download/release/v22.22.1/)
- [Three.js 安装](https://threejs.org/manual/pages/installation.html)
- [Next.js 系统要求](https://nextjs.org/docs/app/getting-started/installation)
- [npm 按版本清单安装](https://docs.npmjs.com/cli/v10/commands/npm-ci/)
- [Git 忽略规则](https://git-scm.com/docs/gitignore)
- [Vercel 排除规则](https://vercel.com/docs/deployments/vercel-ignore)
