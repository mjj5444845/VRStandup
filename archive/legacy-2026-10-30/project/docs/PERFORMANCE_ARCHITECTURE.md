# VR Standup 表演系统规划

## 当前完成的边界

- `app/data/avatars.ts` 是两位演员与四个观众模型的唯一运行时目录，统一维护模型、性别和测试语音。
- `app/components/vr-stage.tsx` 负责室内 WebXR 剧场、演员/观众模型、舞台家具以及面光、侧光和顶光。演员会在说话、赞同、问候与挥手等六段动作间自动交叉淡化循环；观众使用多种坐姿、鼓掌和大笑动作。VR 场景内的临时选角板已移除，选角保留在网页角色卡中。
- `app/components/avatar-selector.tsx` 提供浏览器与移动端的无障碍选角界面。
- `app/lib/performance/types.ts` 定义脚本、台词段落、演员绑定与舞台指令。
- `public/avatars/active/` 只保存上线所需的轻量 GLB；过时 OBJ 在 `archive/deprecated_avatars/`，原始 FBX 在本地 `local_assets/`。
- `public/audio/performers/` 目前保存男女测试语音；播放入口已与选角动作绑定，后续音频提供方可在不修改场景组件的前提下替换资源 URL。

## 下一阶段的数据流

```text
脚本导入
  -> 按角色拆分 PerformanceCue
  -> 校验 avatarId 与台词顺序
  -> 为角色建立 CastBinding
  -> 为每段台词补充情绪、节奏和停顿等 StageDirection
  -> 生成 PerformancePlan
  -> VR 播放器按 cue 顺序驱动动作、灯光和字幕
```

## 建议新增模块

```text
app/api/performances/route.ts         保存与读取演出计划
app/lib/performance/parser.ts         把后续提供的脚本转换为 cue
app/lib/performance/validator.ts      校验角色、顺序、空台词与舞台指令
app/components/performance-player.tsx 场景时间线播放器
public/performances/<show-id>/        本地研究阶段的演出配置与素材
```

## 后续需要确定

1. 脚本中如何标识角色、段落和舞台停顿。
2. 每位演员需要哪些待机、说话、转身和谢幕动作。
3. 字幕、动作和灯光使用固定时长还是由人工时间轴控制。
4. 演出配置保存在本地文件还是接入数据库。
5. 是否需要排练模式、单段预览和时间线跳转。
