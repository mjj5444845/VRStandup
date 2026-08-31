# VR Standup

一个使用 [A-Frame](https://aframe.io/) 与 WebXR 构建的浏览器 VR 脱口秀项目。项目基于 Next.js，可在桌面浏览器、移动设备和兼容 WebXR 的头显中运行，并可直接部署到 Vercel。

当前角色库包含 8 位低多边形演员。用户可以在网页选角区切换演员，也可以进入 VR 后使用舞台右侧选角台切换；选择会保存在当前设备中。

访问 `/voices` 可查看 Mosi 声线选择教程、为每位演员绑定 Voice ID，并生成短台词试听。浏览器只调用本站服务端接口，Mosi API Key 不会进入客户端代码。

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

Mosi TTS 使用服务端环境变量 `MOSS_API_KEY`。本地放在 `.env.local`，线上必须通过部署平台的加密环境变量配置；不要添加 `NEXT_PUBLIC_` 前缀。

## 目录说明

- `app/`：页面、A-Frame 场景与全局样式
- `app/data/avatars.ts`：角色模型、名称与未来声线方向的统一配置
- `app/lib/performance/`：脚本、台词、声线绑定和 TTS 供应商接口
- `app/api/tts/`：Mosi 音色查询与语音生成的服务端代理
- `app/voices/`：声线选择、绑定与试听教程页
- `public/`：会直接公开访问的静态资源
- `public/avatars/`：部署所需的 8 个 OBJ/MTL 角色模型和 CC0 授权
- `docs/PERFORMANCE_ARCHITECTURE.md`：脚本、TTS 与表演调度的后续实现规划
- `standup_video/`：仅保存在本地的原始视频素材，不进入 Git 或部署
- `videoshortcutpic/`：仅保存在本地的视频截图素材，不进入 Git 或部署
- `.openai/hosting.json`：网站部署能力配置

原始视频和截图保留在项目根目录，并由 `.gitignore` 与 `.vercelignore` 排除。要在网页中使用时，应先完成转码与体积优化，再将选定文件放入 `public/media/` 或接入对象存储/CDN。

角色源压缩包同样只保留在本地，根目录下的 `*.zip` 不进入 Git 或部署。

## Vercel 部署

Vercel 会通过 `vercel.json` 识别 Next.js，并运行 `npm run build` 生成标准 `.next` 输出。GitHub 仓库连接到 Vercel 后，推送 `main` 分支即可触发重新部署。

## 操作方式

- 桌面浏览器：鼠标拖动查看，`WASD` 移动
- VR 头显：点击“进入 VR 剧场”启动 WebXR 沉浸模式
- VR 选角：右手柄指向选角台并按下触发键
- 移动设备：触摸拖动查看场景
