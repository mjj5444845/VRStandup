# 历史参考：演员视频面板方案

> 本方案于 2026-10-30 被“三维虚拟演员录制与异步回放”替代。
> 以下保留旧技术设计用于追溯，其中演员线上录制、色键、视频面板、二维手部轨迹和旧验收配置不再作为当前开发要求。
> 研究条件等仍适用的约束已列入[当前系统指南](../SYSTEM_GUIDE.md)；新录制方案见[演员录制与回放](../PERFORMER_RECORDING.md)。

---

# 系统设计与实现指南：PunchCap 工程

更新：2026-10-30。本文件是新版的技术设计依据，按模块逐步实现。

当前完成程度见 [当前状态](../../project/STATUS.txt)。安装和运行按各平台的操作说明执行；
本指南中的完整目录、消息协议、测试及实验服务属于后续目标，不表示已经实现。
当前可执行的命令以根目录 `package.json` 为准。

工作规则统一放在根目录 `AGENTS.md`，这里不保存第二份。原始指南完整保存在
`archive/legacy-2026-10-30/project/系统设计与实现指南.md`，只作为历史资料。

## 概述

本指南描述 PunchCap 正式研究系统的设计与实现方式：参与者戴头显坐在虚拟剧场里，舞台上是一块经过色键抠像的演员视频面板，花字按演员确认过的提示单自动出现，参与者可以用手柄抓取、拉伸、投掷花字；实验员在电脑上推进流程、触发回应、记录数据。

项目已经重新开始：旧系统保存在 `archive/`，当前根目录承载新版。新版使用 Three.js，Mac 开发，Windows 11 实验室电脑运行。舞台、布局、灯光和效果重新制作；选用旧素材时复制到新版资产目录并登记来源。

剧场空间与视觉细化的补充依据见 [建模参考](../SCENE_REFERENCE.md)。参考包尚未接入运行场景。

### 设计要点

| 方面 | 选择 | 依据 |
| --- | --- | --- |
| 运行环境 | 头显浏览器中的 WebXR（Meta Quest 浏览器） | 研究计划：WebXR 技术栈 |
| 渲染 | Three.js，直接使用其 WebXR 支持，不叠加其他 3D 框架 | ADR-0008 |
| 演员 | 舞台上的视频面板，色键抠像；演员线上录制 | 研究计划：舞台视频面板 + 色键抠像；ADR-0001 |
| 声音 | 与视频同一次录制导出的音频，Web Audio 播放并作为主时钟 | ADR-0003 |
| 写意花字的锚点 | 离线标注视频中演员手部的位置轨迹，运行时把花字放到面板上的对应点 | ADR-0009 |
| 花字触发 | 按提示单时间码自动触发；Wizard 只负责 D 条件的回应 | 实验室研究指南；ADR-0004 |
| 实验服务 | 实验室电脑上一个 Node 进程：HTTPS 页面 + WebSocket + 日志 | ADR-0002 |
| 与旧系统的关系 | 旧版归档，新版独立实现 | ADR-0010 |

## 当前工程边界

每次只修改当前小任务需要的文件，开始前列出目标、文件和验收方式。
当前页面、项目配置、模块和文档可按任务需要调整；旧系统已归档，不再使用旧版的冻结白名单。

| 路径 | 用途 |
| --- | --- |
| `app/` | 新版网页入口、参与者端、实验员端和页面样式 |
| `study/core/` | 可独立测试的数据和规则 |
| `study/xr/` | Three.js 场景、播放与交互 |
| `study/web/` | 浏览器通信与录音 |
| `study/server/` | Windows 11 实验室服务 |
| `study/tools/` | 素材处理和场后核查 |
| `public/study/` | 已选定并允许公开的正式素材 |
| `docs/` | 当前指南、操作说明、决策和变更记录 |
| `local_assets/` | 本机原始素材，说明文件之外不进入 Git |
| `data/`、`certs/` | 实验数据与本机证书，不进入 Git |
| `archive/` | 旧版历史资料，新版不得导入其代码或运行时素材 |

### 代码与素材隔离

- 新版模块只导入本层允许的模块及依赖，不引用旧归档代码。
- 运行时素材统一从 `public/study/` 读取。复用素材时复制一份，在 `ASSETS.md` 中登记来源与许可。
- 三维部分直接使用官方 Three.js，不引入旧版 A-Frame。
- M1 将实现 `study/core/boundaries.test.ts` 检查分层；当前该测试尚未建立。
- 原始资料、实际分配表、参与者记录和密钥按 [环境与上传规则](../../guides/SETUP.md) 排除。

## 系统架构

系统由三个运行部件组成，全部由实验室电脑上的一个 Node 进程提供。参与者在头显浏览器打开 `/study`，实验员在电脑浏览器打开 `/lab`，两者通过同一进程里的 WebSocket 与服务端通信，所有事件由服务端统一打时间戳写入磁盘。

### 运行部件

| 部件 | 运行位置 | 职责 |
| --- | --- | --- |
| 实验服务 `study/server/` | 实验室电脑，一个 Node 进程 | HTTPS 托管 Next 页面；WebSocket 转发消息；会话状态；统一时钟；写日志 |
| 参与者端 `/study` | 头显浏览器（WebXR） | 剧场、演员视频面板、虚拟观众、花字、手柄交互、VR 内评分与问卷、头部朝向上报 |
| 实验员控制台 `/lab` | 实验室电脑浏览器 | 选择参与者编号、推进流程、查看投掷并触发回应、记录晕动分数、领夹麦录音 |
| 标注工具 `/lab/annotate` | 开发电脑浏览器 | 标注视频中的手部轨迹；调试色键参数 |
| 离线脚本 `study/tools/` | 开发电脑 | 素材转码、校验段子配置、生成分配表、场后数据核查 |

### 关键技术决策

ADR 是“为什么这样做”的决策记录。下表包含规划中的决策编号，不代表对应文件均已创建；现有文件见 `docs/decisions/`。

| ADR | 决策 | 理由 | 放弃的方案 |
| --- | --- | --- | --- |
| 0001 | 演员是舞台上的视频面板，色键抠像；视频由演员线上录制 | 保留演员本人的表情、口型与节奏，喜剧效果依赖这些；演员只能线上参与，录视频门槛最低 | 3D 虚拟形象（没有表情与口型，演员“表演性”弱）；实时直播（时延与网络风险不可控） |
| 0002 | 实验用自定义 HTTPS 服务器：一个进程同时托管 Next 与 WebSocket | WebXR 要求 HTTPS；同源同证书可避免 `wss` 混合内容问题；App Router 的路由处理器不能承载 WebSocket。Next 的自定义服务器不经过编译、不能与 standalone 输出共用，所以只在实验室使用，不参与线上部署 | `next dev --experimental-https` 加独立 WebSocket 服务（两个端口、两套证书，开发模式不适合正式实验） |
| 0003 | 主时钟是 Web Audio 的 `AudioContext.currentTime`；视频静音，跟随音频时钟 | 音频硬件时钟适合作为统一计时依据；实际声音、花字和视频偏差仍需记录并验证 | 以视频 `currentTime` 为主时钟（精度粗、受解码影响）；`setTimeout` 排程 |
| 0004 | 脚本花字按时间码自动触发，Wizard 只负责 D 条件的回应 | 减少手动触发差异，按统一时间码运行；实际触发偏差仍需验证 | 实验员手动触发全部花字 |
| 0005 | 花字用预先制作的透明 PNG 贴在平面上 | 花字内容事先由演员确认，无需运行时排版；Three.js 没有现成的中文文字渲染 | 运行时生成文字几何或 SDF 字体（需要额外库与中文字体子集） |
| 0006 | VR 内的问卷与评分面板用 Canvas 2D 绘制中文，转为 `CanvasTexture` | 题目会改动，做成图片不便维护；Canvas 使用浏览器自带字体 | 每道题一张 PNG；若 M0 发现头显浏览器缺少中文字体，退回此方案 |
| 0007（已被 0010 替代） | 历史方案，见归档原始指南 | 当前按 ADR-0010 归档旧版并重启 | 不再作为当前工作规则 |
| 0008 | 直接使用 Three.js（`three` 与 `three/addons`），用一个 React 客户端组件挂载 | 帧循环、手柄、视频纹理都需要命令式控制；少一层抽象，agent 与人都更容易排查；依赖最少 | React Three Fiber + @react-three/xr（声明式便利，但多两层依赖，API 随大版本变化）；A-Frame（实体组件系统与 React 状态容易互相覆盖） |
| 0009 | 写意花字锚点来自离线标注的手部轨迹（视频画面坐标），运行时插值 | 视频没有骨骼；离线标注可人工核对，运行时零计算、零误识别 | 运行时手部识别（头显上算力不足，结果不稳定）；只用固定锚点（写意花字无法“拿在手上”） |

### 运行拓扑

```text
 头显浏览器 /study  ──wss──▶  study/server（实验室电脑，HTTPS :8443）  ◀──wss──  电脑浏览器 /lab
 Three.js + WebXR             Next 请求处理 + WebSocket /lab-ws              推进流程、触发回应
 视频面板、观众、花字          会话状态机、统一时钟                           FMS 记录、领夹麦录音
 评分与问卷、朝向 10 次/秒          │ 追加写入                    读取
                                   ▼                              ▲
                          data/sessions/P01/            study/config/allocation.json
                          events.jsonl、pose.csv        public/study/bits/*.json
                          lapel.webm（不提交）          public/study/media、captions
```

头显与控制台只和服务端通信，彼此不直连；分配表只在服务端读取，头显在会话开始时从服务端收到自己的条件顺序。

## 目录结构

下面是目标目录，包含尚未实现的文件；未开发的模块按需建目录，不保留空占位文件。现有文件与当前状态见 `docs/project/STATUS.txt`。

```text
VRStandup/
├── AGENTS.md                       给所有 coding agent 的工作规则
├── CLAUDE.md                       一行：@AGENTS.md
├── README.md                       项目介绍、启动方式与文档入口
├── package.json                    当前可执行命令和依赖清单
├── .gitignore / .vercelignore      Git 与可选 Vercel 命令行排除规则
├── vitest.config.ts                只收集 study/ 下的测试
├── .github/
│   ├── workflows/check.yml         CI：lint、类型检查、测试、配置校验、构建
│   └── pull_request_template.md
│
├── app/
│   ├── study/                      参与者端路由 /study
│   │   ├── page.tsx                服务端组件，只渲染客户端组件
│   │   └── study-client.tsx        动态导入 study/xr，挂载与销毁引擎
│   └── lab/                        实验员控制台 /lab
│       ├── page.tsx
│       ├── lab-client.tsx
│       ├── lab.module.css
│       └── annotate/               标注工具 /lab/annotate
│           ├── page.tsx
│           └── annotate-client.tsx
│
├── study/
│   ├── core/                       纯逻辑：不依赖 DOM、Three.js、Node API，可单元测试
│   │   ├── types.ts                所有研究数据类型
│   │   ├── constants.ts            全部阈值，注释写明出处
│   │   ├── protocol.ts             WebSocket 消息类型与校验（前后端共用）
│   │   ├── conditions.ts           条件规则表
│   │   ├── timeline.ts             段子配置 + 条件 → 按时间排序的事件
│   │   ├── tracks.ts               手部轨迹插值
│   │   ├── allocation.ts           Williams 顺序与段子组轮换
│   │   ├── validate.ts             段子配置校验规则
│   │   ├── session-machine.ts      会话状态机
│   │   ├── questionnaire.ts        评分与问卷题目
│   │   ├── boundaries.test.ts      检查模块导入边界（M1 实现）
│   │   └── *.test.ts               与源文件同目录的单元测试
│   ├── xr/                         Three.js 场景（只在浏览器运行）
│   │   ├── engine.ts               渲染器、场景、XR 会话、帧循环、销毁
│   │   ├── loader.ts               素材预加载与释放
│   │   ├── theater.ts              剧场几何与灯光
│   │   ├── audience.ts             虚拟观众（GLTFLoader + AnimationMixer）
│   │   ├── performer-panel.ts      演员视频面板
│   │   ├── chroma-key.ts           色键着色器材质
│   │   ├── bit-player.ts           音频主时钟、视频跟随、派发时间线
│   │   ├── anchors.ts              把锚点换算到世界坐标
│   │   ├── caption.ts              单个花字：贴图、淡入淡出、生存时间
│   │   ├── caption-layer.ts        并发上限、生成与回收
│   │   ├── controllers.ts          WebXR 手柄、射线
│   │   ├── grab.ts                 抓取、拉伸、投掷、挂载
│   │   ├── stage-catcher.ts        判定花字是否落到舞台
│   │   ├── pose-reporter.ts        头部朝向 10 次/秒
│   │   └── panels/                 text-canvas.ts、rating-panel.ts、questionnaire-panel.ts
│   ├── web/                        浏览器端非 3D 模块（参与者端与控制台共用）
│   │   ├── net.ts                  WebSocket 客户端：重连、离线队列、时钟同步
│   │   └── recorder.ts             领夹麦录音（MediaRecorder）
│   ├── server/                     实验服务（部署在 Windows 11 实验室电脑）
│   │   ├── server.ts               HTTPS + Next + WebSocket 入口
│   │   ├── session.ts              会话与流程推进
│   │   ├── logger.ts               JSONL 与 CSV 写入
│   │   ├── uploads.ts              领夹麦录音接收
│   │   └── *.test.ts               集成测试
│   ├── tools/                      离线脚本（tsx 运行）
│   │   ├── prepare-media.ts        原始录像 → 面板视频 + 音频 + 时长清单
│   │   ├── validate-bits.ts        校验全部段子配置
│   │   ├── make-allocation.ts      生成分配表
│   │   └── check-session.ts        场后数据完整性核查
│   └── config/
│       ├── allocation.example.json 分配表示例（提交）
│       └── allocation.json         正式分配表（脚本生成，不提交）
│
├── public/study/
│   ├── performers.json             演员面板尺寸与色键参数
│   ├── responses.json              回应片段清单
│   ├── audience.json               观众模型、座位、动画名
│   ├── bits/b01.json …             每个段子一份配置
│   ├── media/                      b01.mp4、b01.m4a、manifest.json（实测时长）
│   ├── responses/                  回应片段视频与音频
│   ├── laughs/                     笑声音频（low、mid、high）
│   ├── captions/                   花字 PNG
│   ├── audience/                   观众 GLB
│   ├── tutorial/                   练习场景素材
│   └── ASSETS.md                   素材来源与许可
│
├── docs/
│   ├── README.md                   文档索引与存放约定
│   ├── guides/                     Mac、Windows、头显与功能检查步骤
│   ├── design/                     系统指南、剧场建模参考与座位位置表
│   ├── project/                    STATUS.txt、ROADMAP.md、VALIDATION.md、CHANGELOG.md
│   ├── research/                   前测与后测问卷草稿
│   └── decisions/                  已建立的架构决策记录
│
├── local_assets/                   本机素材、设计参考和工具（不提交，README 除外）
├── output/                         本机检查结果与临时导出（不提交）
├── archive/                        旧版只读归档
│
├── certs/                          本机证书（不提交）
└── data/sessions/                  实验数据（不提交、不部署）
```

页面可正常使用 React、Next.js 和自身样式；以下限制针对研究模块之间的导入。

**分层规则**：`core` 不导入任何其他层；`xr` 与 `web` 可以导入 `core`；`server` 与 `tools` 可以导入 `core`，不导入 `xr`、`web`；`app/study` 只导入 `xr` 与 `web`，`app/lab` 只导入 `web` 与 `core`，唯一例外是标注工具的色键预览可导入 `xr/chroma-key.ts`；`ws` 只能在 `server` 中导入。`boundaries.test.ts` 同时检查这些规则。

**命名约定**：文件名用小写短横线（`bit-player.ts`）；React 组件与类名用大驼峰（`BitPlayer`）；类型名用大驼峰；常量用全大写下划线；导入 `study/` 内模块用仓库已有的 `@/` 路径别名（`@/study/core/types`）。

## 数据模型

全部类型定义在 `study/core/types.ts`，是前端、服务端、离线脚本的唯一来源。时间一律用毫秒整数，字段名以 `Ms` 结尾；段子内时间以段子音频开头为 0。长度单位是米。

### 类型定义

```ts
export type ConditionId = 'A' | 'B' | 'C' | 'D';
export type CaptionMode = 'xieyi' | 'jianli';
export type GroupId = 'G1' | 'G2' | 'G3' | 'G4';
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** 同一次录制导出的静音视频与单声道音频，时间轴相同 */
export type PerformerMedia = {
  video: string;              // '/study/media/b01.mp4'
  audio: string;              // '/study/media/b01.m4a'
  durationMs: number;         // 与 media/manifest.json 的实测值一致（V1）
};

/** public/study/performers.json 中的一项 */
export type PerformerSetup = {
  id: string;                 // 演员代号，如 'C02'
  panelHeightM: number;       // 面板高度，按真人身高设置，如 2.0
  aspect: number;             // 视频宽高比，如 9/16
  chroma: ChromaKey;
};

export type ChromaKey = {
  keyColor: string;           // 背景色，如 '#00b140'
  similarity: number;         // 0 到 1，越大抠掉的颜色范围越宽
  smoothness: number;         // 0 到 1，边缘过渡宽度
  spill: number;              // 0 到 1，去除人物边缘的背景反光
};

/** 视频画面中的一点：u、v 为 0 到 1，原点在画面左上角 */
export type TrackKey = { tMs: number; u: number; v: number };

/** 离线标注的部位轨迹，关键帧之间线性插值 */
export type Track = {
  id: string;                 // 段子内唯一，如 't1'
  part: 'rightHand' | 'leftHand' | 'head';
  keys: TrackKey[];           // 按 tMs 严格递增
};

/** 花字锚点：跟随视频中的部位、固定在面板某点，或固定在舞台上 */
export type CaptionAnchor =
  | { kind: 'track'; track: string; offset: Vec3 }    // offset 为面板局部坐标：x 向右、y 向上、z 朝向观众
  | { kind: 'panel'; uv: Vec2; offset: Vec3 }
  | { kind: 'stage'; position: Vec3 };

export type CaptionCue = {
  id: string;                 // 段子内唯一，如 'c1'
  mode: CaptionMode;
  asset: string;              // '/study/captions/bottle-outline.png'
  atMs: number;               // 出现时间
  durationMs: number;         // 无人交互时的生存时间，上限 5000
  anchor: CaptionAnchor;
  sizeM: number;              // 平面宽度
  opacity: number;            // 0 到 1
  enterMs: number;            // 淡入时长
  throwable: boolean;         // 仅在 D 条件下生效
  responseClipId?: string;    // 被扔上舞台后可用的特定回应
};

export type Punchline = {
  id: string;
  pauseStartMs: number;       // 包袱前停顿开始
  atMs: number;               // 包袱落点
};

export type LaughCue = {
  atMs: number;
  durationMs: number;
  intensity: 'low' | 'mid' | 'high';
};

export type ResponseWindow = { startMs: number; endMs: number };

export type BitConfig = {
  schemaVersion: 1;
  id: string;                 // 'b01'
  group: GroupId;
  performer: string;          // PerformerSetup.id
  media: PerformerMedia;
  tracks: Track[];
  punchlines: Punchline[];
  laughs: LaughCue[];
  captions: CaptionCue[];     // 同一个段子同时包含写意与间离两套（V7）
  responseWindows: ResponseWindow[];
  confirmedBy: string;        // 演员代号与确认日期，如 'C02@2027-01-20'
};

/** public/study/responses.json 中的一项 */
export type ResponseClip = {
  id: string;                 // 'r-generic-01'、'r-b01-c2'
  performer: string;
  media: PerformerMedia;
};

export type Round = { condition: ConditionId; group: GroupId; bitIds: string[] };

export type Assignment = {
  participantId: string;      // 'P01'
  orderId: 'O1' | 'O2' | 'O3' | 'O4';
  block: number;
  rounds: Round[];            // 长度 4
};
```

### 段子配置示例

`public/study/bits/b01.json` 的格式示例，素材、日期和演员代号均为示意，不表示素材已到位或演员已确认：

```json
{
  "schemaVersion": 1,
  "id": "b01",
  "group": "G1",
  "performer": "C02",
  "media": { "video": "/study/media/b01.mp4", "audio": "/study/media/b01.m4a", "durationMs": 74000 },
  "tracks": [
    {
      "id": "t1", "part": "rightHand",
      "keys": [
        { "tMs": 22600, "u": 0.62, "v": 0.48 },
        { "tMs": 23000, "u": 0.60, "v": 0.44 },
        { "tMs": 23400, "u": 0.57, "v": 0.40 },
        { "tMs": 23800, "u": 0.566, "v": 0.396 },
        { "tMs": 24200, "u": 0.562, "v": 0.392 },
        { "tMs": 24600, "u": 0.558, "v": 0.388 },
        { "tMs": 25000, "u": 0.554, "v": 0.384 },
        { "tMs": 25400, "u": 0.55, "v": 0.38 }
      ]
    }
  ],
  "punchlines": [{ "id": "p1", "pauseStartMs": 29500, "atMs": 31000 }],
  "laughs": [{ "atMs": 31200, "durationMs": 2600, "intensity": "mid" }],
  "captions": [
    {
      "id": "c1", "mode": "xieyi", "asset": "/study/captions/bottle-outline.png",
      "atMs": 22800, "durationMs": 2500,
      "anchor": { "kind": "track", "track": "t1", "offset": [0, 0.06, 0.05] },
      "sizeM": 0.18, "opacity": 0.6, "enterMs": 250, "throwable": false
    },
    {
      "id": "c2", "mode": "jianli", "asset": "/study/captions/tiny-drop.png",
      "atMs": 32400, "durationMs": 5000,
      "anchor": { "kind": "panel", "uv": [0.5, 0.05], "offset": [0, 0.25, 0.05] },
      "sizeM": 0.3, "opacity": 1, "enterMs": 150, "throwable": true,
      "responseClipId": "r-b01-c2"
    }
  ],
  "responseWindows": [{ "startMs": 34000, "endMs": 36000 }],
  "confirmedBy": "C02@2027-01-20"
}
```

示例中，演员在 22.6 秒做“拿起瓶子”的无实物动作，写意花字 c1 从 22.8 秒起跟随右手轨迹 t1；间离花字 c2 在笑声开始 1.2 秒后出现在演员头顶上方。

### 校验规则（`validate.ts`）

M2 要求每条规则配套单元测试；计划中的 `npm run validate:study` 对 `public/study/` 下全部配置执行，任何一条失败即退出码非零，并用中文指出文件、字段与原因。

| 编号 | 规则 | 依据 |
| --- | --- | --- |
| V1 | 所有时间在 0 到 `media.durationMs` 之间；`media.durationMs` 与 `media/manifest.json` 的实测时长相差不超过 200 毫秒 | 防止配置与录像错位 |
| V2 | 任何花字的显示区间不得与任一 `[pauseStartMs, atMs)` 重叠 | 花字设计指南：包袱前停顿禁区 |
| V3 | 间离花字的 `atMs` 必须落在某个笑声开始后 500 到 2000 毫秒之间 | 花字设计指南：间离在笑声后出现 |
| V4 | 任意时刻同时存在的花字不超过 2 个 | 花字设计指南：同屏上限 |
| V5 | 花字 `durationMs` 不超过 5000 | 生存时间机制 |
| V6 | 写意花字 `throwable` 必须为 false | 写意花字服务想象，不服务互动 |
| V7 | 每个段子至少有 1 个写意花字和 1 个间离花字 | 段子组会轮换到任何条件 |
| V8 | `track` 锚点引用的轨迹存在；关键帧 `tMs` 严格递增，`u`、`v` 在 0 到 1 之间；轨迹覆盖花字整个显示区间；相邻关键帧间隔不超过 500 毫秒 | 防止花字脱离手部或跳变 |
| V9 | `asset`、`media.video`、`media.audio` 指向的文件存在于 `public/` | 防止实验中出现空白 |
| V10 | `responseClipId` 存在于 `responses.json`，且演员一致 | 防止回应换人 |
| V11 | `performer` 存在于 `performers.json` | 防止面板尺寸或色键参数缺失 |
| V12 | 4 个段子组的预评分均值相差不超过阈值（阈值在 WP2 确定，写入 `constants.ts`） | 实验室研究指南：段子组匹配 |

### 事件日志

服务端写入 `data/sessions/<参与者编号>/events.jsonl`，每行一个事件：

```json
{"v":1,"tServerMs":1735000123456,"tClientMs":81235,"pid":"P01","round":2,"condition":"C","bitId":"b05","type":"caption.shown","data":{"captionId":"c2","bitTimeMs":32401}}
```

| 事件类型 | 发送方 | 关键字段 |
| --- | --- | --- |
| `session.started` / `session.ended` / `session.aborted` | 服务端 | 原因 |
| `round.started` / `round.ended` | 服务端 | 条件、段子组 |
| `bit.started` / `bit.ended` | 参与者端 | 段子编号、音频实际开始时间 |
| `media.drift` | 参与者端 | 每秒一次：视频与音频时钟的偏差、当前播放速率 |
| `caption.shown` / `caption.expired` | 参与者端 | 花字编号、段子内时间 |
| `caption.grabbed` / `caption.released` / `caption.stretched` / `caption.attached` | 参与者端 | 花字编号、位置、缩放 |
| `caption.thrown` / `caption.landed` | 参与者端 | 速度、是否落到舞台 |
| `response.requested` / `response.played` | 控制台 / 参与者端 | 回应片段编号、延迟 |
| `rating.submitted` | 参与者端 | 段子编号、分数 |
| `questionnaire.submitted` | 参与者端 | 题目编号与答案 |
| `fms.recorded` | 控制台 | 快速晕动量表（FMS）分数 |
| `recording.started` / `recording.stopped` | 控制台 | 领夹麦录音的起止 |
| `clock.sync` | 服务端 | 往返时延、时钟偏移 |
| `note` | 控制台 | 异常说明 |

头部朝向数据量大，单独写入 `pose.csv`：`tServerMs,tClientMs,round,bitId,bitTimeMs,yawDeg,pitchDeg,stageAngleDeg`。`stageAngleDeg` 是视线方向与“参与者到演员头部”方向的夹角；演员头部位置取该段子 `head` 轨迹的插值点，没有 `head` 轨迹时取面板上沿以下 10% 处的中点。在参与者端计算，便于直接用于“看舞台”比例的分析。

## 通信协议

参与者端与控制台都通过 `wss://<实验室电脑地址>:8443/lab-ws` 连接服务端。消息是 JSON，形如 `{ "type": "...", "data": {...} }`；类型与校验函数定义在 `study/core/protocol.ts`，前后端共用同一份文件，任何一方改协议都会在类型检查时暴露。

### 连接与身份

- 连接后第一条消息必须是 `hello`，声明角色：`{ role: 'participant' | 'console', protocolVersion: 1 }`；
- 服务端同一时刻只接受 1 个参与者端与 1 个控制台；第二个同角色连接被拒绝并提示；
- 协议版本不一致时服务端拒绝连接，避免头显缓存了旧页面。

### 消息清单

| 方向 | 消息类型 | 数据 | 说明 |
| --- | --- | --- | --- |
| 控制台 → 服务端 | `session.start` | `participantId` | 服务端从分配表取出该编号的 4 轮安排 |
| 服务端 → 参与者端 | `session.config` | `Assignment`、所需段子配置的路径 | 参与者端据此预加载 |
| 参与者端 → 服务端 | `session.ready` | 预加载结果、浏览器版本 | 首轮素材就绪才算准备好 |
| 控制台 → 服务端 | `phase.next` | 无 | 推进状态机到下一阶段（见“核心模块设计”） |
| 服务端 → 参与者端 | `phase.enter` | 阶段名、轮次 | 参与者端切换画面 |
| 参与者端 → 服务端 | `event` | 日志事件 | 服务端补上 `tServerMs` 后写入 |
| 参与者端 → 服务端 | `pose` | 一批朝向样本 | 每 500 毫秒发一批，每批 5 个样本 |
| 服务端 → 控制台 | `throw.landed` | 花字编号、可用回应片段 | 控制台高亮可选回应 |
| 控制台 → 服务端 → 参与者端 | `response.play` | 回应片段编号 | 参与者端在下一个回应窗口播放 |
| 控制台 → 服务端 | `fms.record` | 分数 | 写入日志 |
| 控制台 → 服务端 | `note` | 文本 | 异常说明 |
| 控制台 → 服务端 | `session.abort` | 原因 | 任何阶段可中止 |
| 服务端 → 双方 | `state` | 当前阶段、轮次、连接状态 | 每次变化后广播，控制台据此刷新界面 |
| 双方 ↔ 服务端 | `ping` / `pong` | 发送时间 | 时钟同步与心跳 |

### 时钟同步

分析需要把头显上的事件、服务端时间和电脑上的领夹麦录音对齐到同一条时间轴。

1. 参与者端连接后立即做 10 次 `ping`/`pong`：记录发送时间 `t0`、服务端时间 `ts`、接收时间 `t1`；
2. 取往返时延 `t1 - t0` 最小的那次，偏移量 `offset = ts - (t0 + t1) / 2`；
3. 之后每 30 秒再做一次，偏移量写入 `clock.sync` 事件；
4. 分析时用 `tClientMs + offset` 换算到服务端时间；领夹麦录音以 `recording.started` 事件的服务端时间为音频零点。

这是 NTP 思路的简化版（Mills, 1991）。局域网内往返时延通常只有几毫秒，误差远小于花字时间窗与笑声标注的精度。

### 断线处理

- 参与者端断线后自动重连（间隔 1、2、4 秒，最多 10 次），重连后重新 `hello` 并请求 `state`；
- 断线期间产生的事件暂存在本地队列，重连后补发，`tClientMs` 保持原值；
- 正在播放的段子不中断；若断线超过 10 秒，控制台显示警告，由主持人按“实验室研究指南”的故障处理执行。

## 核心模块设计

设计原则：**逻辑与渲染分离**。凡是能写成纯函数的（条件规则、排程、轨迹插值、分配、校验、状态机）都放在 `study/core/`，用单元测试保证正确；`study/xr/` 只负责把纯函数的结果画出来、把交互事件报上去。

### 条件规则 `conditions.ts`

四个条件的差别全部集中在一张表里，其他模块只查表，不写 `if (condition === 'B')`。

```ts
export const CONDITION_RULES: Record<ConditionId, {
  captionModes: readonly CaptionMode[];
  grabbable: boolean;   // 能否抓取查看
  throwable: boolean;   // 能否投掷、挂载
  responses: boolean;   // 演员是否回应
}> = {
  A: { captionModes: [],                   grabbable: false, throwable: false, responses: false },
  B: { captionModes: ['xieyi'],            grabbable: true,  throwable: false, responses: false },
  C: { captionModes: ['jianli'],           grabbable: true,  throwable: false, responses: false },
  D: { captionModes: ['xieyi', 'jianli'],  grabbable: true,  throwable: true,  responses: true  },
};
```

### 排程 `timeline.ts`

`buildTimeline(bit, condition)` 把一个段子配置与一个条件转成按时间排序的事件数组，供播放器逐个派发。

```ts
export type TimelineEvent =
  | { atMs: number; kind: 'laugh'; cue: LaughCue }
  | { atMs: number; kind: 'caption'; cue: CaptionCue; grabbable: boolean; throwable: boolean }
  | { atMs: number; kind: 'responseWindow'; window: ResponseWindow };

export function buildTimeline(bit: BitConfig, condition: ConditionId): TimelineEvent[];
```

规则：笑声在所有条件下都相同；花字按 `CONDITION_RULES[condition].captionModes` 过滤；`grabbable` 取条件规则；`throwable` 取“花字自身设置”与“条件允许”的与；回应窗口只在 D 条件下生成。排序稳定：同一时刻按 laugh、caption、responseWindow 的顺序。

### 轨迹插值 `tracks.ts`

- `sampleTrack(track, tMs)`：在相邻关键帧之间线性插值，返回 `{ u, v }`；早于第一帧或晚于最后一帧时返回端点值（V8 已保证花字显示区间被覆盖）；
- 二分查找关键帧，单次调用为对数时间，每帧调用无压力；
- 测试覆盖：端点、关键帧恰好命中、两帧之间、单帧轨迹。

### 分配 `allocation.ts`

- `WILLIAMS_ORDERS`：O1 至 O4 四种顺序，与“实验室研究指南”的表一致；
- `assign(index)`：第 `index` 位参与者（从 0 开始）得到顺序 `index % 4`、区块 `floor(index / 4)`，段子组起始位按区块右移；
- 单元测试断言：每个条件在每个轮次恰好出现一次；每个有序相邻对恰好出现一次；16 人时每个“条件 × 段子组”组合恰好 4 次。

### 引擎 `engine.ts`

- `createEngine(container, deps)` 返回 `{ start, stop, dispose }`；`app/study/study-client.tsx` 在 `useEffect` 中动态导入并创建，清理函数中调用 `dispose`。开发模式下 React 会执行“挂载、卸载、再挂载”，因此 `dispose` 必须完全释放渲染器、纹理、几何体、视频元素与事件监听，再次创建不留残余；
- 渲染器：`WebGLRenderer`，`xr.enabled = true`，参考空间 `local-floor`，关闭阴影，像素比与 XR 帧缓冲缩放写在 `constants.ts`，数值以 M0-S6 的实测为准；
- 参与者固定坐在第二排中间：相机放在一个“座位”节点下，头显的位移只在座位附近生效，不提供移动；
- “进入 VR”是自己的按钮：同一次点击里依次调用 `audioContext.resume()`、给全部视频元素做一次静音 `play()`/`pause()` 解锁、`navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })`，再交给 `renderer.xr.setSession`。用一次点击同时满足音频、视频与 XR 的用户手势要求；
- 帧循环：`renderer.setAnimationLoop(tick)`，`tick` 按固定顺序调用各模块的 `update(frame)`：播放器 → 观众动画 → 锚点 → 花字 → 交互 → 朝向上报 → 渲染。各模块不各自开 `requestAnimationFrame`。

### 剧场与观众 `theater.ts`、`audience.ts`

- 剧场用简单几何体搭建（舞台台面、背景墙、座椅、两盏聚光），材质用 `MeshLambertMaterial` 或 `MeshBasicMaterial`，控制性能；
- 观众：按 `public/study/audience.json` 加载 GLB，每位观众一个 `AnimationMixer`，在 `idle`、`laugh`、`clap` 三个动作间交叉淡入（0.45 秒）；笑声事件到来时每位观众加 0 到 300 毫秒的随机延迟，结束后回到 `idle`；
- 观众的笑声音频由播放器统一播放，观众模块只负责动作。

### 演员面板 `performer-panel.ts` 与 `chroma-key.ts`

- 面板是一个 `PlaneGeometry`，高度取 `panelHeightM`，宽度为高度乘 `aspect`，底边贴在舞台台面上，位于舞台中央；
- 纹理是 `VideoTexture`，视频元素 `muted`、`playsInline`、`preload="auto"`、`crossOrigin="anonymous"`，不插入页面 DOM；
- 色键用 `ShaderMaterial`：把像素与 `keyColor` 转到 YCbCr 空间，比较色度距离；`alpha = smoothstep(similarity, similarity + smoothness, 距离)`；再按 `spill` 降低人物边缘偏向背景色的分量。材质 `transparent: true`、`depthWrite: false`；
- 颜色空间：视频纹理为 sRGB，自定义着色器需要显式处理输出颜色空间转换。M0-S4 用同一帧在桌面浏览器与头显中截图对比，确认颜色一致；
- 回应片段与段子共用同一块面板，播放器切换的是视频元素与纹理来源。

### 播放器 `bit-player.ts`

- 段子音频用 `decodeAudioData` 解码为 `AudioBuffer`，经 `PannerNode` 放在面板上演员头部的高度，形成空间声音；
- 开始播放时在同一帧内启动音频 source 与视频 `play()`，记下 `startCtxTime`；每帧计算 `bitTimeMs = (ctx.currentTime - startCtxTime) * 1000`，派发所有 `atMs <= bitTimeMs` 且尚未派发的时间线事件；
- **视频跟随**：每帧读取视频时间（支持时优先用 `requestVideoFrameCallback` 回调中的 `mediaTime`，否则用 `video.currentTime`），计算 `drift = 视频时间 - bitTimeMs`。`|drift|` 超过 40 毫秒时把 `playbackRate` 调为 0.95 或 1.05 追赶，回到 10 毫秒以内恢复 1.0；超过 300 毫秒时直接跳转到 `bitTimeMs`。阈值写在 `constants.ts`，每秒记一次 `media.drift`；
- **笑声**：播放对应强度的笑声音频，同时通知观众模块切换动作；
- **回应片段**：收到 `response.play` 后排队，到下一个回应窗口时：停止当前音频 source 并记下位置、暂停段子视频；在同一块面板上播放回应片段（同样以音频为主时钟）；播完后从记下的位置新建 source 继续段子、视频跳转到同一位置；
- 播放结束发 `bit.ended`。

**内存**：只预加载并解码当前轮与下一轮的段子；回应片段与笑声常驻；每轮结束释放上一轮的 `AudioBuffer`、视频元素（移除 `src` 并调用 `load()`）与纹理。

### 锚点 `anchors.ts`

- `track` 锚点：用 `sampleTrack` 得到 `(u, v)`，换算为面板局部坐标 `x = (u - 0.5) × 宽`、`y = (0.5 - v) × 高`，加上 `offset`，再用面板的 `localToWorld` 转为世界坐标；
- `panel` 锚点：同上，只是 `(u, v)` 固定；`stage` 锚点直接用舞台坐标；
- 花字始终面向参与者（只绕竖直轴旋转，避免低头时花字翻转）；
- 花字被抓取后立即解除锚定。

### 花字 `caption.ts` 与 `caption-layer.ts`

- 花字是一个 `Mesh`：`PlaneGeometry` 宽 `sizeM`、高按图片比例；`MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })`，不受舞台灯光影响；贴图预加载，颜色空间设为 sRGB；
- 生命周期：淡入 `enterMs` → 显示 → 无人交互满 `durationMs` 后淡出移除；被抓取后不再计时；
- `caption-layer` 维护当前存活列表；新花字到来时若已有 2 个，让“未被抓取的最早一个”先淡出（运行时保护，配置已由 V4 保证）；
- 发送 `caption.shown`、`caption.expired`。

### 交互 `controllers.ts`、`grab.ts` 与 `stage-catcher.ts`

手柄用 `renderer.xr.getController(i)` 取得指向姿态，`getControllerGrip(i)` 加 `three/addons` 的 `XRControllerModelFactory` 显示手柄模型；每只手柄挂一条射线，用手柄的世界矩阵设置 `Raycaster`，只与当前可交互的花字和面板选项求交。

| 动作 | 输入 | 实现 |
| --- | --- | --- |
| 抓取 | 射线指向花字时按住扳机（`selectstart`） | 用 `Object3D.attach` 把花字挂到手柄下，保持当前世界位置 |
| 松开 | 松开扳机（`selectend`） | `attach` 回场景根节点 |
| 拉伸 | 两只手柄同时抓住 | 缩放 = 当前两手距离 ÷ 开始时两手距离，限制在 0.5 到 3 倍 |
| 投掷 | 抓住时挥动后松开 | 用最近 100 毫秒手柄位置估算速度，之后按抛物线运动，1.5 秒后或落地时停止 |
| 挂载 | 抓住时按握把键（`squeezestart`） | 挂到参与者自己头顶上方（只允许挂在自己身上，见实验室研究指南） |

- 能否抓取、能否投掷来自时间线事件中的 `grabbable` 与 `throwable`，交互模块只读这两个值，不判断条件；
- `stage-catcher` 是舞台上方的一个包围盒（`Box3`）；投掷中的花字中心进入包围盒即判定“落到舞台”，发送 `caption.landed`，服务端转发 `throw.landed` 给控制台；
- 回应规则（每段最多 2 次、不在包袱前停顿中回应）由控制台界面执行：超出次数的按钮变灰。

### 测量 `pose-reporter.ts` 与 VR 面板

- 每 100 毫秒读取 XR 相机的世界朝向，计算偏航角、俯仰角，以及与“相机到演员头部”方向的夹角，攒满 5 个样本发一次；
- `rating-panel` 与 `questionnaire-panel`：用 `text-canvas.ts` 在 Canvas 2D 上画中文题目与选项，转为 `CanvasTexture`；选项是可被射线点中的平面；点选后高亮 300 毫秒再提交，防止误触；题目与选项文本来自 `study/core/questionnaire.ts`。

### 标注工具 `/lab/annotate`

- 选择一个段子配置与对应视频，可 0.25 倍到 1 倍速播放、逐帧前后移动；
- 选择轨迹与部位后，在画面上点击即在当前时间添加关键帧，可拖动修改、按键删除；时间轴上显示花字显示区间与包袱前停顿禁区，并实时显示 V8 是否通过；
- 色键预览：同一画面实时套用 `performers.json` 中的参数，可调节后复制新参数；
- 导出：把轨迹 JSON 复制到剪贴板，由你粘贴进段子配置。工具不直接写文件，避免意外覆盖已确认的配置。

### 会话状态机 `session-machine.ts`

状态机运行在服务端，参与者端只跟随 `phase.enter`。用纯函数实现：`next(state, event) => state`，便于测试。

```text
idle
  → connected        参与者端 hello 且首轮素材预加载完成
  → tutorial         练习场景（中性方块）
  → round(1).bits    依次播放本轮段子，每段后 rating
  → round(1).survey  条件后问卷
  → round(1).rest    主持人记录 FMS 后 phase.next
  … round(4) …
  → exit             摘头显，后续问卷在纸面或平板完成
  → done
任意状态 → aborted   session.abort
```

非法转换（例如 tutorial 直接跳到 round(3)）被拒绝并写入日志。

## 工程规范

### 代码

- **TypeScript strict**（仓库已开启）；禁止 `any`，确需绕开类型时用 `unknown` 并在边界处校验；
- **外部输入必须校验**：段子 JSON、`performers.json`、`responses.json`、WebSocket 消息、分配表在进入系统时校验，校验失败给出可读的中文错误，不让错误数据流入后续模块；
- **分层**：按“目录结构”的分层规则导入；M1 建立边界测试后自动检查；
- **一个帧循环**：所有逐帧逻辑都通过 `engine.ts` 的 `tick` 调用；
- **资源必须释放**：每个创建纹理、几何体、视频元素、事件监听的模块都提供 `dispose()`；
- **不新增全局状态**：参与者端的会话状态只来自服务端的 `state` 消息；
- **常量集中**：时间窗、并发上限、采样频率、跟随阈值等写在 `study/core/constants.ts`，并在注释中写明出处（例如“花字设计指南：同屏上限”）；
- **注释与界面语言**：代码注释用英文，界面文字用中文；
- **依赖克制**：新增依赖只有 `three`、`@types/three`（渲染）、`ws`、`@types/ws`（实验服务）、`tsx`（运行 TypeScript 脚本）、`vitest`、`@vitest/coverage-v8`（测试）、`cross-env`（跨平台环境变量）；全部用 `npm install -E` 锁定精确版本；再加依赖需要写 ADR。

### 测试

以下是后续模块的验收要求。目前已有静态检查、类型检查与独立配置、通信、同步规则、素材完整性测试，不把尚未建立的正式模块测试记为通过。

| 层级 | 工具 | 覆盖对象 | 要求 |
| --- | --- | --- | --- |
| 单元测试 | Vitest | `study/core/` 全部纯函数 | 行覆盖率不低于 90% |
| 边界测试 | Vitest | `boundaries.test.ts` | 每次必跑 |
| 配置校验 | `npm run validate:study` | `public/study/` 下全部配置 | 每次改配置必跑 |
| 集成测试 | Vitest + `ws` 客户端 | 实验服务的握手、状态机推进、日志写入 | 用临时目录，不写真实数据目录 |
| 设备验收 | 人工，按清单 | 头显上的渲染、交互、帧率、音画同步 | 每个涉及 VR 的里程碑结束时做一次，记录在 PR 描述中 |

VR 渲染与手柄交互无法可靠地自动化测试，因此用设备验收清单代替；设备验收必须记录头显型号、浏览器版本、平均帧率、`media.drift` 的最大绝对值。

### 脚本

当前已可用：`dev`、`build`、`start`、`lint`、`typecheck`、`check`、`test:spike`、`spike:cert`、`spike:https`、`spike:net`、`spike:media-fixture`。
当前 `check` 为静态检查、类型检查与 23 项独立配置、通信、同步与色键规则、素材完整性测试。Mac 使用 `npm`，Windows PowerShell 使用 `npm.cmd`。
HTTPS 检查服务的准备与启动见 [05-第二个工作-HTTPS与头显连接](../../guides/05-第二个工作-HTTPS与头显连接.txt)，不包含正式研究通信或记录。
S2 的测试消息与同端口验证见 [06-第三个工作-两个网页传消息](../../guides/06-第三个工作-两个网页传消息.txt)；本机模式严格限制 loopback，
不是正式研究协议，不包含 M4 的状态机、自动重连或实验日志。
S3 的独立同步检查与原创测试素材见 [07-第四个工作-声音与视频同步](../../guides/07-第四个工作-声音与视频同步.txt)；
不直接替代正式播放器、演员素材或真实设备验收，40 毫秒标准未放宽。

下面是后续模块计划增加的命令，现阶段不可直接照抄执行；只有对应文件、依赖和测试就绪后才加入 `package.json`：

```json
{
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "validate:study": "tsx study/tools/validate-bits.ts",
  "check": "npm run lint && npm run typecheck && npm run test && npm run validate:study",
  "lab:media": "tsx study/tools/prepare-media.ts",
  "lab:allocate": "tsx study/tools/make-allocation.ts",
  "lab:dev": "tsx study/server/server.ts",
  "lab": "next build && cross-env NODE_ENV=production tsx study/server/server.ts",
  "lab:check-session": "tsx study/tools/check-session.ts"
}
```

当前静态检查和类型检查已排除 `archive/`。后续测试也只收集新版模块。实验室目标是 Windows 11；需要设置跨平台环境变量时使用 `cross-env`，不用 Mac 专有的 `export` 写法。

`vitest.config.ts`：`test.include` 为 `['study/**/*.test.ts']`，`environment: 'node'`；覆盖率只统计 `study/core/**`；`resolve.alias` 把 `@` 指向仓库根目录，与 `tsconfig.json` 的路径别名一致。测试文件显式 `import { describe, it, expect } from 'vitest'`，不依赖全局变量（避免依赖隐式全局测试类型）。

### 分支与提交

- 保持主分支可构建；用户要求创建分支时按当次要求命名，默认使用 `codex/` 前缀；
- 提交信息用 Conventional Commits：`feat(study): add caption layer`、`fix(study-server): reject duplicate console`、`test(study): cover williams balance`、`docs(study): add ADR-0009`；
- 一个提交只做一件事；重构与功能分开提交；
- 提交、推送、创建或合并 PR 按用户明确要求执行，不把完成小任务当作自动上传授权。下方为以后需要 PR 时使用的模板。

### Pull Request 模板（`.github/pull_request_template.md`）

```markdown
## 里程碑与任务
M? / T?.?

## 改了什么
-

## 本次涉及的文件与原因
-

## 质量门禁
- [ ] npm run check 通过
- [ ] npm run build 通过
- [ ] 新增纯逻辑都有单元测试
- [ ] 设备验收（如涉及 VR）：头显型号 / 浏览器版本 / 平均帧率 / 最大音画偏差
- [ ] 如有架构变化，已新增 ADR
```

### 持续集成（`.github/workflows/check.yml`）

计划在 M1 建立自动检查：使用与 `.nvmrc` 一致的 Node.js 版本，安装依赖、检查和构建。当前尚未建立 CI 工作流；后续应分别覆盖 Mac 与 Windows，不能只验证一个系统。

### ADR 格式

`docs/decisions/NNNN-标题.md`，固定四节：**背景**（要解决什么问题）、**决策**、**理由与放弃的方案**、**后果**（带来的约束与风险）。ADR 一旦合并不再修改；推翻时新写一份，并在旧文件开头注明“已被 NNNN 取代”。

## 里程碑

共 10 个里程碑，按依赖拆成可单独验收的小任务。先完成环境准备，再做 M0 技术验证；M3 与 M4 的技术依赖允许分别推进。当前协作仍按用户节奏一次完成一个小任务。表内工期仅为原始估计，不是交付承诺。

| 里程碑 | 内容 | 依赖 | 估计工作量 |
| --- | --- | --- | --- |
| M0 | 技术验证 | 无 | 4 到 6 天 |
| M1 | 工程基线 | M0 | 1 天 |
| M2 | 数据模型与纯逻辑 | M1 | 3 到 4 天 |
| M3 | 素材管线与标注工具 | M2 | 3 到 4 天 |
| M4 | 实验服务与控制台骨架 | M2 | 4 到 5 天 |
| M5 | 参与者端：剧场、演员面板、段子播放 | M3、M4 | 5 到 6 天 |
| M6 | 花字引擎 | M5 | 4 天 |
| M7 | 交互与回应 | M6 | 5 天 |
| M8 | 测量：评分、问卷、朝向、录音 | M5 | 4 天 |
| M9 | 完整流程、数据核查与预实验 | M7、M8 | 1 到 2 周 |

### M0 技术验证

**目标**：在真实头显上验证 7 个高风险假设，避免做到一半才发现走不通。验证页面使用 `app/spike/`，独立验证代码使用 `study/spikes/`；已有基础方块和 S1 连接检查代码，实际头显验收待完成。必要依赖在对应验证开始时安装并固定版本。临时代码不自动并入正式运行模块；结论写进 `docs/project/VALIDATION.md`，影响方案的决定另写 ADR。

| 编号 | 要验证的问题 | 通过标准 | 不通过时的退路 |
| --- | --- | --- | --- |
| S1 | 自定义 HTTPS 服务器能否在局域网内托管 Next 页面，头显能否接受证书并进入 VR | 头显打开 `https://<IP>:8443`，点击按钮进入 VR | 改用 `next dev --experimental-https` 加独立 WebSocket 服务 |
| S2 | 同一端口上 WebSocket 与 Next 共存 | 头显与电脑浏览器都能连上 `/lab-ws`，开发模式下热更新不受影响 | 把 WebSocket 放到另一个端口 |
| S3 | 音频主时钟加视频跟随 | 连续播放 60 秒，`media.drift` 最大绝对值小于 40 毫秒；记录 `requestVideoFrameCallback` 是否可用 | 记录失败原因，提出时钟或同步方案调整并另行确认；不自行放宽验收阈值 |
| S4 | 色键抠像在头显上的效果 | 用演员在家录的测试视频，人物边缘无明显绿边、头发不缺失；桌面与头显颜色一致 | 离线抠像，导出带透明通道的 VP9 WebM，运行时不做色键（需同时验证解码性能） |
| S5 | 一次点击同时解锁音频、视频与 XR 会话 | 进入 VR 后音频与视频都能播放，无需第二次点击 | 在 VR 内加一个“开始”面板，用手柄点击作为第二次手势 |
| S6 | 完整场景帧率 | 1080p 视频面板 + 8 位观众 + 2 个花字 + 手柄射线，平均帧率不低于头显刷新率的 90% | 视频降到 720p、减少观众、降低 XR 帧缓冲缩放 |
| S7 | 头显浏览器的 Canvas 能否画出中文 | 问卷面板中文清晰无方块字 | 题目改为预制 PNG（ADR-0006 的退路） |

S4 已提供独立 `/spike/chroma` 预览与默认显卡色块检查，操作见 [视频去背景说明](../../guides/08-第五个工作-视频去背景.txt)。
原创几何样片只验证功能，真实演员、Windows 与头显结果仍待实测。

### M1 工程基线

**任务**

1. 核对现有 `AGENTS.md`、`CLAUDE.md` 和文档链接，不重复粘贴工作规则；
2. 按需要添加测试依赖及已实现脚本的命令；依赖使用准确版本；
3. 新增 `vitest.config.ts`（见“工程规范”）；
4. 检查现有私密文件排除规则；本项目实验室部署不依赖 Vercel；
5. 创建当前不存在的 `.github/workflows/check.yml`，配置 Mac 和 Windows 自动检查；
6. 新增 `study/core/boundaries.test.ts`，实现代码隔离与分层规则的检查；
7. 用真实边界检查验证规则，不能只放一个永远通过的占位测试来宣称基线完成。

**验收**：测试和边界检查已真正接入；检查与构建通过；Mac、Windows 自动检查通过；本次涉及文件与任务一致。

### M2 数据模型与纯逻辑

**任务**：在 `study/core/` 实现 `types.ts`、`constants.ts`、`conditions.ts`、`timeline.ts`、`tracks.ts`、`allocation.ts`、`validate.ts`、`session-machine.ts`、`protocol.ts`、`questionnaire.ts`，每个都配同名测试；实现 `study/tools/validate-bits.ts` 与 `study/tools/make-allocation.ts`；准备 2 个示例段子配置 `public/study/bits/example-*.json`、对应的 `performers.json` 与 `responses.json`，素材用占位文件。

**必须有的测试**

- `allocation`：Williams 平衡的三条性质（见“核心模块设计”）；
- `timeline`：每个条件下花字过滤正确；`grabbable`、`throwable` 取值正确；事件排序稳定；只有 D 条件有回应窗口；
- `tracks`：端点、命中关键帧、两帧之间、单帧轨迹；
- `validate`：V1 至 V12 每条至少 1 个通过用例与 1 个失败用例；
- `session-machine`：全部合法转换可达；所有非法转换被拒绝；
- `protocol`：每种消息的校验函数拒绝缺字段与多余字段。

**验收**：`npm run check` 通过，`npm run test:coverage` 显示 `study/core/` 行覆盖率不低于 90%；`npm run lab:allocate -- --n 16` 生成的分配表与“实验室研究指南”中的表一致。

### M3 素材管线与标注工具

**任务**

1. `study/tools/prepare-media.ts`：调用本机 `ffmpeg` 与 `ffprobe`（不作为 npm 依赖）。输入演员原始录像，输出静音 H.264 MP4（高度不超过 1920、30 帧每秒、`+faststart`）与单声道 48 kHz AAC 音频（`.m4a`），两者来自同一输入、时间轴一致；把实测时长写入 `public/study/media/manifest.json`；可选参数裁剪起止时间；
2. `/lab/annotate` 标注工具（见“核心模块设计”）；
3. 单元测试：`ffmpeg` 命令参数的拼装与 `manifest.json` 的读写用纯函数实现并测试；不在 CI 中调用 `ffmpeg`。

**验收**：用一段真实测试录像跑通转码，`manifest.json` 时长与播放器实测相差不超过 50 毫秒；在标注工具中完成一条手部轨迹，粘贴进示例配置后 `npm run validate:study` 通过；色键预览可调参数。

### M4 实验服务与控制台骨架

**任务**

1. `study/server/server.ts`：读取 `certs/` 下证书；创建 HTTPS 服务器；普通请求交给 Next 的 `app.getRequestHandler()`；`upgrade` 事件中，路径为 `/lab-ws` 的交给 `ws`，其他交给 Next 的升级处理（开发模式热更新需要；以 M0-S2 的验证结果为准）；
2. `study/server/session.ts`：握手、角色限制、协议版本检查、状态机推进、广播 `state`；
3. `study/server/logger.ts`：按参与者编号建目录，追加写 `events.jsonl` 与 `pose.csv`，每 1 秒或每 100 行刷新一次；进程退出时刷新；
4. `study/web/net.ts`：重连、离线队列、时钟同步；
5. `app/lab/`：控制台界面，包括参与者编号选择、当前阶段与轮次、“下一步”按钮、中止按钮、FMS 输入、备注输入、连接状态；
6. 集成测试：用两个 `ws` 客户端模拟参与者与控制台，走完 idle 到 done 的全流程，检查日志文件内容。

**验收**：电脑浏览器打开 `/lab` 能启动会话；模拟参与者脚本能走完全流程；日志字段与“数据模型”一致。

### M5 参与者端：剧场、演员面板、段子播放

**任务**：`app/study/` 路由与 `study-client.tsx`；`engine.ts`、`loader.ts`、`theater.ts`、`audience.ts`、`performer-panel.ts`、`chroma-key.ts`、`bit-player.ts`；“进入 VR”按钮同时解锁音频、视频与 XR；预加载首轮素材后发送 `session.ready`。

**验收**：头显上完整播放 2 个示例段子；`media.drift` 最大绝对值小于 40 毫秒；笑声事件与配置时间误差小于 30 毫秒；色键效果与 M0-S4 一致；帧率达到 M0-S6 的标准；离开页面再进入不出现重复渲染或声音。

### M6 花字引擎

**任务**：`anchors.ts`、`caption.ts`、`caption-layer.ts`；按条件过滤花字；生存时间与并发上限；`caption.shown` 与 `caption.expired` 事件；准备写意与间离各 2 张示例 PNG。

**验收**：四个条件下花字出现情况与 `CONDITION_RULES` 一致；写意花字跟随标注的手部轨迹，目视无明显滞后；间离花字在笑声后出现；设备验收帧率达标。

### M7 交互与回应

**任务**：`controllers.ts`、`grab.ts` 的抓取、松开、拉伸、投掷、挂载；`stage-catcher.ts`；控制台显示投掷并按回应规则提供按钮；`bit-player` 在回应窗口播放回应片段后续播；全部交互事件写日志。

**验收**：B、C 条件只能抓取不能投掷；D 条件投掷到舞台后控制台 1 秒内收到；回应在下一个回应窗口播放并续播段子，续播后音画偏差回到 40 毫秒以内；同一段子回应不超过 2 次。

### M8 测量

**任务**：`text-canvas.ts`、`rating-panel.ts`、`questionnaire-panel.ts`（题目来自 `questionnaire.ts`，与“实验室研究指南”一致）；`pose-reporter.ts`；`study/web/recorder.ts` 在控制台录制领夹麦，结束后上传到 `study/server/uploads.ts` 保存为 `lapel.webm`，开始与结束时发送 `recording.started`、`recording.stopped`。

**验收**：`pose.csv` 采样间隔约 100 毫秒、无大段缺失；问卷答案完整写入日志；录音时长与会话时长相差不超过 1 秒。

### M9 完整流程、数据核查与预实验

**任务**：练习场景（中性灰色方块）；按状态机串起全部阶段；`study/tools/check-session.ts` 实现“实验室研究指南”的场后核查清单；用真实段子配置与录像替换示例；完成 3 到 5 人预实验并修正问题。

**验收**：按“实验室研究指南”的单场流程完整跑通；`npm run lab:check-session -- P01` 输出全部通过；预实验问题清单全部关闭或写明不修理由。

## 助手规则与技能说明

- `AGENTS.md` 是当前助手工作规则的唯一正文，不再在指南内保存旧副本。
- `CLAUDE.md` 仅保留对 `AGENTS.md` 的兼容引用，没有另一套工作规则。
- 当前项目没有自定义 `SKILL.md` 或项目技能目录。应用自带技能不属于本仓库。
- 每次只落实一个小任务，先列目标、文件和验收，再实现并报告结果。
- 资料有矛盾时说明具体差异；用户已明确的新要求优先。缺少研究依据时不编造参数。

## 安装与运行说明

现在请按以下文件操作：

1. [01-Mac开发与运行](../../guides/01-Mac开发与运行.txt)：Mac 本机开发与检查。
2. [02-Mac到Windows传文件](../../guides/02-Mac到Windows传文件.txt)：准备源文件与版本清单。
3. [03-Windows11安装与运行](../../guides/03-Windows11安装与运行.txt)：Windows 11 本机安装、构建和查看页面。
4. [04-第一个工作-三维显示检查](../../guides/04-第一个工作-三维显示检查.txt)：基础画面与按钮检查。
5. [05-第二个工作-HTTPS与头显连接](../../guides/05-第二个工作-HTTPS与头显连接.txt)：检查服务、证书准备与真实设备验收。
6. [06-第三个工作-两个网页传消息](../../guides/06-第三个工作-两个网页传消息.txt)：先在本机确认同端口消息收发，Windows 和头显另行实测。
7. [07-第四个工作-声音与视频同步](../../guides/07-第四个工作-声音与视频同步.txt)：音频计时、视频跟随与完整 60 秒的原始偏差检查。
8. [08-第五个工作-视频去背景](../../guides/08-第五个工作-视频去背景.txt)：原片对照、色键参数、本机视频与头显效果检查。

头显连接检查代码已经实现，Windows 与真实头显的安全连接待实测。
正式实验服务、领夹麦录音和场后数据核查尚未实现。
`lab`、`lab:dev`、`lab:media`、`lab:allocate`、`lab:check-session` 都是后续计划命令，
目前不在 `package.json` 中，不能作为当前启动步骤。

Windows 的证书与网络访问步骤见 05；正式实验每日启动和数据备份留待对应模块。
必须在目标电脑与头显上实测。不能把忽略浏览器证书警告当作连接验证已经通过。

## 风险与参考资料

### 技术风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 演员在家录制的背景不均匀 | 色键边缘有残影、头发缺失 | 给演员一份录制说明（纯色布、均匀光、不穿与背景同色的衣服，见工作清单 WP2）；不达标时用离线抠像退路（M0-S4） |
| 音画不同步 | 观感变差、花字与动作错位 | 音频为主时钟、视频跟随（ADR-0003）；记录 `media.drift`；设备验收检查最大偏差 |
| 头显内存或解码能力不足 | 页面崩溃、视频卡顿 | 只预加载当前轮与下一轮；同一时刻只播放一个视频；每轮结束释放资源；分辨率按 M0-S6 确定 |
| React 开发模式重复挂载 | 两套渲染器、两路声音 | `dispose` 完全释放（见“引擎”）；M5 验收包含“离开再进入” |
| 页面上出现两份 Three.js | 体积增大、对象类型判断失效 | 正式系统页面不加载 `aframe`；`boundaries.test.ts` 检查 |
| 浏览器更新改变 WebXR 行为 | 实验中途交互失效 | 实验期间关闭系统更新；每场记录浏览器版本；只用手柄，不依赖手部追踪 |
| Three.js 或 Next 升级改变接口 | 渲染或实验服务无法启动 | 依赖锁定精确版本；实验期间不升级；升级前先跑全部测试与设备验收 |
| 局域网掉线 | 事件丢失 | 参与者端本地队列与补发；断线超过 10 秒由主持人按故障流程处理 |
| 帧率不足引起晕动 | 参与者不适、数据作废 | M0-S6 确定性能预算；每个涉及 VR 的 PR 记录帧率 |

### 参考资料

- Three.js 文档：[WebXRManager](https://threejs.org/docs/#api/en/renderers/webxr/WebXRManager)、[VideoTexture](https://threejs.org/docs/#api/en/textures/VideoTexture)、[ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial)、[AnimationMixer](https://threejs.org/docs/#api/en/animation/AnimationMixer)；官方示例 `webxr_vr_dragging`（手柄射线与抓取）
- W3C：[WebXR Device API](https://www.w3.org/TR/webxr/)；[Web Audio API](https://www.w3.org/TR/webaudio/)（`AudioContext.currentTime` 的定义）
- WICG：[`HTMLVideoElement.requestVideoFrameCallback()`](https://wicg.github.io/video-rvfc/)（视频帧的媒体时间）
- Next.js：[Custom Server](https://nextjs.org/docs/app/guides/custom-server)（自定义服务器的用法与限制）
- [mkcert](https://github.com/FiloSottile/mkcert)：本地证书工具；[FFmpeg](https://ffmpeg.org/documentation.html)：转码
- Mills, D. L. (1991). Internet time synchronization: The Network Time Protocol. *IEEE Transactions on Communications*, 39(10), 1482–1493.（时钟同步思路）
- Nygard, M. (2011). Documenting Architecture Decisions.（ADR 格式的出处）
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/)
- 研究计划文档的其他部分：“花字设计指南”（时间窗、并发上限、两种模式的参数）、“实验室研究指南”（条件定义、分配表、问卷、单场流程）、“工作清单”（WP2 录制、WP3 系统任务）
