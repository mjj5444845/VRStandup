# VR 剧场精修计划与验收

日期：2026-11-04。对应 ROADMAP 的 M5 / V02–V06，兼顾 M6 花字视线和 M9 集中设备验收。保持四桌、24座、v3 Mixamo 改编人物、音频主时钟与研究条件。场景美术版本与人体映射版本分开管理。

## 案例学习

查阅以下官方作品介绍和展示；设计启发属于本项目的分析，不是原作者提供的量化标准，也不构成素材授权。

| 作品与来源 | 学习重点 | 在本项目的落地 |
| --- | --- | --- |
| [Demeo / Heroes’ Hangout](https://www.resolutiongames.com/demeo) | 官方介绍强调围桌社交；展示图中灯光、家具形成不同活动区域 | 舞台是最清晰区域，观众席保留辨认度，外围装饰降低对比；不用霓虹与强烈明暗照搬游戏 |
| [Moss](https://www.polyarcgames.com/games/moss) | 官方强调可触达、会回应操作的立体场景 | 前景观众、中景舞台、后景幕布形成层次；给演员手势与花字留出空间 |
| [Job Simulator](https://jobsimulatorgame.com/) | 官方介绍按厨房、办公室、商店等用途组织可操作物品 | 话筒归舞台侧边、书本和植物归书架、桌灯落在桌面；装饰不误导为可抓取对象 |

## 已发现的问题

1. 网页实景全场偏黄，方向光照亮整间房，演员与观众区域缺少层次；检查页还额外加了补光，与正式运行不一致。
2. 旧检查只测预演座位。初步真实蒙皮射线检查在1.2米工程眼高中发现7、21、22号座位被前方观众遮住演员头部；要扩大到全部座位和观众动作采样。
3. 演员门底部在0.36米，门外侧没有与舞台相连的落脚平台；应补充侧翼及踏步，不改变原投掷舞台判定区域。
4. 墙画、低位文字海报、灯具的层次需要整理；家具应检查全部配对，不能仅检查同桌椅子。
5. 本机缺少历史 `local_assets/models/human-v3/` 和 Soft Clay Club 源包；运行GLB存在。保留运行基线，基于它建立新的 Blender 精修副本，不声称恢复了原始制作源件。

## 实施与逐项验收

| 顺序 | 具体工作 / 文件 | 完成标准 |
| --- | --- | --- |
| 1 | 将当前GLB另存本机基线；`scripts/art/` 增加可重复的精修脚本 | 不读取归档、不下载第三方模型、不覆盖历史原件；重复执行无累加位移 |
| 2 | 检查家具实体、坐姿、门口、侧通道；必要的小幅座位错位同步 `study/core/theatre.ts`、GLB、`scene-layout.json` | 四桌24座一致；家具无实体重叠；物品与支撑面接触；变化逐项记录 |
| 3 | Blender 制作舞台侧翼、踏步、低调的边缘收口；调整现有表面色彩 | 舞台侧门有支撑、踏步落地；保留演员中心和原舞台互动范围；不向主要视线加入道具 |
| 4 | 统一 Three.js 光照：柔和环境光、局限舞台的暖主光与补光，接触阴影 | 正式场景与复查共用；不增加实时阴影贴图或后处理；灯光参数有单一来源 |
| 5 | 复查页增加参与者眼位、全部座位选择、反向舞台视角 | 选择座位时隐藏本人；全景与眼位明确区分；退出时释放资源 |
| 6 | 增加真实GLB几何与动态视线测试，回归哈希、模型映射、动画和资源释放 | 自动检查覆盖物品配对、支撑面、通道、视线；反例证明检查能识别遮挡 |
| 7 | 浏览器全场/俯视/眼位/侧门/坐姿截图复核；运行 `npm run check`、`npm run build` | 保存结果和实际限制到 VALIDATION、STATUS、tasks；不把结构通过写成审美认可 |

## 工程取值与边界

几何容差、通道保护区、眼高采样均为本场景工程检查参数，不冒充建筑规范、人体工学标准或研究阈值。射线只能证明采样点之间无遮挡，不能证明任意身体动作、任意身高、整张脸或花字始终无遮挡。检测要保留检查条件；若某些采样失败，先修布局，不能通过隐藏其他观众或只保留默认座位让测试通过。

真实录制动作、Quest双眼近距离观感、低头/侧身、花字抓取可达范围、刷新率90%目标、Windows实验室全流程与美术认可仍分别验收。不得使用桌面FPS替代Quest性能，也不新增未经确认的正式研究规则。

## 复现准备

Mac 使用 Steam 安装的 Blender 5.2.3 LTS；Windows 使用本机安装的 Blender，路径由使用者指定。Node依赖在各自平台安装，不复制 `node_modules` 或 `.next`。具体执行命令和本次结果在完成后补充到本文及 `../project/VALIDATION.md`。

## 本轮交付与操作

已实施：保留4桌24座，对遮挡位置进行小幅错位；增加演员侧翼平台、两级12厘米踏步和边缘收口；调低背景材质饱和度，增加舞台局部双灯与家具接触阴影。人物GLB、真实录制、研究条件、舞台投掷判定区域保持原版本。

新增检查覆盖30件落地家具的435组配对、9处物品支撑、四处通道/门前保护区、舞台侧翼和踏步接缝。视线取演员脸部区域左/中/右三个点，采样1.1/1.2/1.3米眼高，以及观众静坐/笑声的0、1、2.5秒状态，共1296条射线；这是离散工程覆盖，不能外推到所有动作与身高。测试另含真实遮挡物、桌椅重叠、灯具悬空、通道占用和平台错位反例。

打开 `/study/scene-review`：先看“全场”“俯视布局”，再从“检查座位”逐个选择1–24号；切换“工程眼高”，检查演员脸部与前排人物轮廓；“舞台看观众”“侧门与踏步”“坐姿与椅子”用于反向和接触检查。全场/俯视隐藏部分墙顶，其余空间视角保留墙顶；检查页不采集研究记录，眼高选项也不会修改头显原始眼高。

本机新增源件在 `local_assets/models/scene-polish-v4/`：

- `scene-before-polish.glb`：首次精修前的只读使用基线，不覆盖。
- `stage-details.blend` / `stage-details.glb`：Blender制作的新增部分。
- `club-polished-review.blend`：当前运行模型组装的可编辑整场副本；不声称恢复了旧人物的原始制作过程。
- `changes.json`：逐个座椅与话筒的前后坐标。

复现前需要该目录中的 `scene-before-polish.glb` 与当前公开运行文件。仅复制已精修的Git仓库不能还原本机历史基线；缺失时脚本明确报错，不能用输出覆盖基线。重建会更新精修输出，手工改过的Blender工程须另存版本。

Mac（项目根目录，已安装本机依赖）：

```sh
"$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python scripts/art/polish-club.py
node --import tsx scripts/art/polish-club.mjs
"$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python scripts/art/build-human-stage.py -- --output local_assets/models/scene-polish-v4/club-polished-review.blend
npm run check
npm run build
npm run dev
```

Windows PowerShell（Blender路径按本机安装位置调整；本机安装依赖，不复制Mac构建产物）：

```powershell
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/polish-club.py
node --import tsx scripts/art/polish-club.mjs
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/build-human-stage.py -- --output local_assets/models/scene-polish-v4/club-polished-review.blend
npm.cmd run check
npm.cmd run build
npm.cmd run dev
```

成功标志：Blender输出 `POLISH_DETAILS_COMPLETE` / `EDITABLE_STAGE_COMPLETE`；Node输出基线保存路径；完整检查和构建退出码为0；网页能显示全部视角并切换座位。若出现基线缺失，恢复上述文件后再运行；若Blender在Metal初始化崩溃或本机通信测试报 `listen EPERM`，检查执行环境权限，不修改断言绕过。Mac实际结果见[验证记录](../project/VALIDATION.md)，Windows和Quest仍需分别执行。

## 最终位置改动（米，网页Y向上）

下表记录相对本轮运行基线的变化，保留物品数量、方向和人体模型。最大平面移动约0.40米；重新检查后仍保留两侧及后方保护通道。

| 节点 | 原位置 (x,y,z) | 新位置 (x,y,z) |
| --- | --- | --- |
| Table_3_Chair_1 | -2.34, 0, 0.65 | -2.74, 0, 0.6 |
| Table_4_Chair_3 | 2.34, 0, 0.65 | 2.39, 0, 0.65 |
| Rear_R1_C1 | -2.23, 0, 2.56 | -2.48, 0, 2.51 |
| Rear_R1_C2 | -1.338, 0, 2.56 | -1.488, 0, 2.66 |
| Rear_R2_C1 | -2.23, 0, 3.62 | -2.18, 0, 3.62 |
| Rear_R2_C3 | -0.446, 0, 3.62 | -0.296, 0, 3.62 |
| Rear_R2_C4 | 0.446, 0, 3.62 | 0.346, 0, 3.62 |
| Rear_R2_C5 | 1.338, 0, 3.62 | 1.038, 0, 3.62 |
| Rear_R2_C6 | 2.23, 0, 3.62 | 1.98, 0, 3.67 |
| StageMic | 1, 0.36, -3.5 | 1.15, 0.368, -3.65 |
