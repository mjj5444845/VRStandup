# PunchCap

基于 Three.js 与 WebXR 开发的虚拟脱口秀研究系统。目标是让演员预录动作和声音，由三维虚拟演员在剧场中回放，参与者观看并与花字互动。

当前软件已开发到 M4：统一数据规则、演员录制与私密素材库、会话服务、可靠通信、日志和控制台预演。每阶段先自动检查，设备项目留到集中验收；最终研究配置、真实资产、剧场与完整测量界面尚待确认和后续接入。

使用 macOS 开发，Windows 11 实验室电脑运行会话与私密数据服务。

## 两个网站入口

- [开发进度看板 · GitHub Pages](https://mjj5444845.github.io/VRStandup/)：任务搜索、阶段进展、验收范围和下一步工作。
- [用户系统入口 · Vercel](https://vr-standup.vercel.app/)：参与者准备、演员录制、实验员工作台；当前开放准备与工程预演，正式研究尚未开放。

需要实验室服务的页面会先引导填写实验员提供的网址，再进入实验室页面；不在 Vercel 输入实验室访问密钥或上传私密素材。部署与验证方法见 [网站入口说明](docs/guides/17-网站入口与部署.txt)。

## 本地启动

安装 `.nvmrc` 指定的 Node.js 版本，在项目根目录执行：

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

打开 [本地首页](http://127.0.0.1:3000)。Windows PowerShell 中将 `npm` 替换为 `npm.cmd`。
完整安装步骤见 [Mac 指南](docs/guides/01-Mac开发与运行.txt) 和 [Windows 11 指南](docs/guides/03-Windows11安装与运行.txt)。

运行正式模块与双端工程预演：

```sh
npm run check
npm run build
npm run assets:rehearsal
npm run lab:start
```

首次生成的工程样例只在本机；已有配置不重复覆盖。打开 [会话控制](http://127.0.0.1:3002/lab/session)、[参与者预演](http://127.0.0.1:3002/study/session)、[演员录制与复查](http://127.0.0.1:3002/record) 或 [私密素材库](http://127.0.0.1:3002/lab/assets)。角色密钥、HTTPS 和运行步骤见 [M4 启动指南](docs/guides/15-开发至M4的启动与预演.txt)。

独立技术检查使用另一个检查服务（其消息格式与正式服务不同）：

```sh
npm run build
npm run spike:net
```

打开 [开发进度看板](http://127.0.0.1:3001/progress)、[参与者准备](http://127.0.0.1:3001/study)、[实验员工作台](http://127.0.0.1:3001/lab) 或 [技术检查目录](http://127.0.0.1:3001/checks)。
独立检查也可以直接打开 [真实动作与声音录制](http://127.0.0.1:3001/spike/record)、[模拟三维动作回放](http://127.0.0.1:3001/spike/replay)、[通信检查](http://127.0.0.1:3001/spike/network)、[音画同步检查](http://127.0.0.1:3001/spike/media) 或 [视频去背景检查](http://127.0.0.1:3001/spike/chroma)。头显局域网访问使用可信 HTTPS；已授权的 USB 调试可转发到头显 localhost，配置与实测范围见 [头显连接指南](docs/guides/05-第二个工作-HTTPS与头显连接.txt)。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `app/` | 网页入口、界面与样式 |
| `scripts/` | 模块边界、工程检查与跨平台测试入口 |
| `study/` | 研究系统代码：条件规则、浏览器功能与独立技术检查 |
| `public/study/` | 网页使用的公开素材及来源登记 |
| `docs/` | 运行指南、系统设计、开发进度与研究问卷 |
| `local_assets/` | 本机原始素材、场景参考包及工具，不随 Git 上传 |
| `archive/` | 保留原样的旧版工程 |

检查项目使用 `npm run check`，生产构建使用 `npm run build`。
每次推送后，GitHub 会在 macOS 与 Windows 运行同一套检查和构建；结果见 [自动检查](https://github.com/mjj5444845/VRStandup/actions/workflows/check.yml)。这不代替实验室电脑或头显验收。
仅检查代码分层使用 `npm run check:boundaries`，操作与错误示例见 [模块边界检查说明](docs/guides/10-第七个工作-模块边界检查.txt)。
实验数据、本机证书、密码与临时输出不进入 Git；文件保存范围见 [环境与上传规则](docs/guides/SETUP.md)。

## 文档

- [准备页与工作台使用](docs/guides/11-准备网页与条件规则.txt) · [跨平台自动检查](docs/guides/12-GitHub跨平台自动检查.txt)
- [真实动作与声音录制检查](docs/guides/13-真实动作与声音录制检查.txt)：Quest 校准、采集、本机保存和重新读取回放。
- [M4 启动与预演](docs/guides/15-开发至M4的启动与预演.txt) · [素材整理审核](docs/guides/16-演员素材整理与审核.txt) · [集中实机清单](docs/project/DEVICE_TESTS.md)
- [场景与资产需求](docs/design/ASSET_REQUESTS.md)：优先准备什么、搜索/生成要求与交付格式。
- [文档目录](docs/README.md)：按用途查找操作说明和设计资料。
- [任务清单](docs/project/tasks.json)（看板数据来源） · [当前状态](docs/project/STATUS.txt) · [开发计划](docs/project/ROADMAP.md) · [检查记录](docs/project/VALIDATION.md)
- [系统设计](docs/design/SYSTEM_GUIDE.md) · [演员录制与回放](docs/design/PERFORMER_RECORDING.md) · [剧场建模参考](docs/design/SCENE_REFERENCE.md)
