# VR Standup

一个使用 [A-Frame](https://aframe.io/) 与 WebXR 构建的浏览器 VR 脱口秀项目。项目基于 Vite/Vinext，可在桌面浏览器、移动设备和兼容 WebXR 的头显中运行。

## 本地开发

要求 Node.js 22.13 或更高版本。

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
- `standup_video/`：现有原始视频素材（Git LFS 管理，暂不进入网页构建）
- `videoshortcutpic/`：现有视频截图素材
- `.openai/hosting.json`：网站部署能力配置

原始视频目前保留在项目根目录，避免开发构建一次性打包约 493 MB 素材。要在网页中使用时，应先完成转码与体积优化，再将选定文件放入 `public/media/` 或接入对象存储/CDN。

## 操作方式

- 桌面浏览器：鼠标拖动查看，`WASD` 移动
- VR 头显：点击“进入 VR 剧场”启动 WebXR 沉浸模式
- 移动设备：触摸拖动查看场景
