# VR Standup

一个使用 [A-Frame](https://aframe.io/) 与 WebXR 构建的浏览器 VR 脱口秀项目。项目基于 Next.js，可在桌面浏览器、移动设备和兼容 WebXR 的头显中运行，并可直接部署到 Vercel。

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
- `public/`：会直接公开访问的静态资源
- `standup_video/`：仅保存在本地的原始视频素材，不进入 Git 或部署
- `videoshortcutpic/`：仅保存在本地的视频截图素材，不进入 Git 或部署
- `.openai/hosting.json`：网站部署能力配置

原始视频和截图保留在项目根目录，并由 `.gitignore` 与 `.vercelignore` 排除。要在网页中使用时，应先完成转码与体积优化，再将选定文件放入 `public/media/` 或接入对象存储/CDN。

## Vercel 部署

Vercel 会通过 `vercel.json` 识别 Next.js，并运行 `npm run build` 生成标准 `.next` 输出。GitHub 仓库连接到 Vercel 后，推送 `main` 分支即可触发重新部署。

## 操作方式

- 桌面浏览器：鼠标拖动查看，`WASD` 移动
- VR 头显：点击“进入 VR 剧场”启动 WebXR 沉浸模式
- 移动设备：触摸拖动查看场景
