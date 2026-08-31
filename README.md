# VR Standup

一个使用 [A-Frame](https://aframe.io/) 与 WebXR 构建的浏览器 VR 脱口秀项目。项目基于 Next.js，可在桌面浏览器、移动设备和兼容 WebXR 的头显中运行，并可直接部署到 Vercel。

当前运行时提供 Ch02 女演员与 Ch06 男演员两种表演者选择，并用四个不同的轻量 Mixamo Avatar 组成八位虚拟观众。用户点击演员时会同步播放对应测试语音；选择会保存在当前设备中。

## 本地开发

要求 Node.js 22.13 或更高版本。安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

部署前请复制 `.env.example` 为对应环境配置，并将 `NEXT_PUBLIC_SITE_URL` 改为实际站点域名，以生成正确的社交分享链接。

## 目录说明

- `app/`：页面、A-Frame 场景与全局样式
- `app/data/avatars.ts`：男女演员、语音和观众模型的统一配置
- `app/lib/performance/`：脚本、台词、演员绑定和舞台指令类型
- `public/`：会直接公开访问的静态资源
- `public/avatars/active/`：部署所需的两位演员与四位轻量观众 GLB
- `public/audio/performers/`：由本地 WAV 转码得到的网页测试语音
- `public/assets/stage/`：从 Kenney 素材包提取的舞台、座椅、桌凳、音箱与绿植 GLB，共享色板及许可证
- `app/avatar-lab/`：使用 `aframe-extras` animation-mixer 的 GLB clip 切换验证页
- `tools/mixamo/`：批量生成、瘦身和验证 Mixamo GLB 的工具
- `local_assets/`：原始 FBX、WAV、ZIP 与完整 Blender 输出；除说明文件外不进入 Git
- `archive/deprecated_avatars/`：旧 OBJ/MTL 与旧 FBX 的固定过时档案位置
- `docs/PERFORMANCE_ARCHITECTURE.md`：脚本、动作、灯光与字幕调度的后续实现规划
- `standup_video/`：仅保存在本地的原始视频素材，不进入 Git 或部署
- `videoshortcutpic/`：仅保存在本地的视频截图素材，不进入 Git 或部署
- `.openai/hosting.json`：网站部署能力配置

原始视频和截图保留在项目根目录，并由 `.gitignore` 与 `.vercelignore` 排除。要在网页中使用时，应先完成转码与体积优化，再将选定文件放入 `public/media/` 或接入对象存储/CDN。

角色源压缩包、原始语音和完整 Mixamo 输出只保留在 `local_assets/`，不进入 Git 或部署。

## Vercel 部署

Vercel 会通过 `vercel.json` 识别 Next.js，并运行 `npm run build` 生成标准 `.next` 输出。GitHub 仓库连接到 Vercel 后，推送 `main` 分支即可触发重新部署。

## 操作方式

- 桌面浏览器：鼠标拖动查看，`WASD` 移动
- VR 头显：点击“进入 VR 剧场”启动 WebXR 沉浸模式
- VR 选角：右手柄指向选角台并按下触发键
- 移动设备：触摸拖动查看场景

## Mixamo 动画角色

访问 `/avatar-lab` 可以在 A-Frame/WebXR 中切换 Ch02 与 Ch06，并验证 16 个独立 animation clips。完整的 11 角色批处理、运行时瘦身和验证说明见 [`tools/mixamo/PIPELINE.md`](tools/mixamo/PIPELINE.md)。
