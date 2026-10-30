# Mixamo → A-Frame Avatar Pipeline

此目录包含一个针对 Blender 5.2.x LTS 的 Mixamo 自动化处理流程。它把一个 With Skin/T-Pose Character FBX 与 `idle/`、`perform/`、`sit/` 中所有 Without Skin Animation FBX 合并为一个包含独立 animation clips 的 GLB。

脚本严格使用 Blender 5.x 的 `Action → Layer → Keyframe Strip → Channelbag → F-Curve` 数据模型，并以冒号后的 semantic bone name 匹配任意 Mixamo namespace，例如 `mixamorig11:Hips` 与 `mixamorig:Hips`。

## 目录结构

```text
local_assets/mixamo/             # 仅本地，不上传
├── characters/                  # With Skin / T-Pose FBX
├── idle/                        # Without Skin animation FBX
├── perform/
├── sit/
└── output/                      # 完整 GLB / manifest / master blend

public/avatars/active/           # 唯一允许部署的 Avatar
├── performers/
└── audience/
```

原始 FBX 与完整输出只保留在 `local_assets/`。网页只加载 `public/avatars/active/` 中经过贴图缩放和 clip 裁剪的派生 GLB。

## Blender 图形界面使用

1. 使用 Blender 5.2.x 新建一个空文件。
2. 打开 `Scripting` 工作区。
3. 打开 `mixamo_aframe_batch_builder.py`。
4. 点击 `Run Script`。
5. 在文件选择器中选择一个 `characters/*.fbx`。

注意：脚本会清空当前 Scene，请勿在包含未保存工作的 Blender 文件中运行。

脚本会自动扫描同级项目根目录下的 `idle/*.fbx`、`perform/*.fbx` 与 `sit/*.fbx`，单个动画失败时会记录错误并继续处理其余文件。

## 无界面自动运行

```powershell
blender --factory-startup --background `
  --python tools/mixamo/mixamo_aframe_batch_builder.py `
  -- local_assets/mixamo/characters/Ch02_nonPBR.fbx
```

## 输出

```text
local_assets/mixamo/output/
├── Ch02_nonPBR_avatar_master.blend
├── Ch02_nonPBR_avatar.glb
├── Ch02_nonPBR_animations.json
├── Ch02_nonPBR_avatar_validation.json
└── Ch02_nonPBR_avatar_aframe_runtime_validation.json
```

- `*_avatar_master.blend`：唯一 `AvatarRig`、角色 Mesh/Material/Texture 和静音 NLA action stash。
- `*_avatar.glb`：供 A-Frame/Three.js/WebXR 运行时加载；贴图以支持透明通道的 WebP 内嵌，降低网络传输体积。
- `*_animations.json`：clip 名称、帧范围、时长、骨骼匹配率、namespace 重映射数量、root motion 与逐文件告警。
- `*_avatar_validation.json`：GLB 重新导入 Blender 后的自动验收结果。
- `*_avatar_aframe_runtime_validation.json`：Three.js GLTFLoader 与 AnimationMixer 的运行时加载、动作创建和交叉切换结果。

## 重新验证 GLB

```powershell
blender --factory-startup --background `
  --python tools/mixamo/validate_mixamo_glb_blender52.py `
  -- local_assets/mixamo/output/Ch02_nonPBR_avatar.glb `
  --manifest local_assets/mixamo/output/Ch02_nonPBR_animations.json `
  --required IDLE_Idle PERFORM_Talking1 PERFORM_Waving SIT_Sitting1
```

验证器会检查：GLB 可重新导入、唯一 Armature、65 根骨骼、所有 Mesh 仍蒙皮、材质/贴图存在、manifest clips 完整、指定动作可采样、pose bounds 与对象 scale 没有异常。

## 批量生成全部 11 个角色与运行时资源

```powershell
.\tools\mixamo\build_all_runtime.ps1 `
  -Blender 'C:\path\to\blender.exe'
```

脚本会先处理 `characters/` 中全部 FBX，再生成两位全动作演员与四位轻量观众；每个观众保留 8 个坐姿、鼓掌与大笑动作。当前性别标注为：男 Ch06、Ch08、Ch23、Ch31、Ch42；女 Ch02、Ch07、Ch21、Ch22、Ch27、Ch37。

## A-Frame 使用

项目中的 `/avatar-lab` 页面会真实加载输出 GLB 与 `aframe-extras`：

```html
<a-entity
  gltf-model="#mixamo-avatar"
  animation-mixer="clip: PERFORM_Talking1; loop: repeat; crossFadeDuration: 0.3"
></a-entity>
```

运行时切换：

```js
avatar.setAttribute(
  'animation-mixer',
  'clip: PERFORM_Waving; loop: repeat; crossFadeDuration: 0.3',
);
```

## 已验证结果（11 Characters / Blender 5.2.1 LTS）

2026-08-31 已批量处理 Ch02、Ch06、Ch07、Ch08、Ch21、Ch22、Ch23、Ch27、Ch31、Ch37、Ch42：全部角色均为 16/16 clips、65/65 骨骼匹配、0 errors。完整 GLB 合计约 97 MB，只在本地保存；部署用两位演员与四位观众合计约 18.5 MB。

- 16/16 个 Animation FBX 成功。
- 每个动画均为 65/65 骨骼匹配，match ratio 为 100%。
- 每个动作重写 520 条带 namespace 的 F-Curve path。
- GLB 重新导入后包含 1 个 `AvatarRig`、65 根骨骼、6 个蒙皮 Mesh、4 个 Material、8 个 Texture 和 16 个独立 clips。
- `IDLE_Idle`、`PERFORM_Talking1`、`PERFORM_Waving`、`SIT_Sitting1` 的起始/中间/结束帧采样均通过 pose 与 scale 健全性检查。
- 同一组动作已通过 A-Frame 所用 Three.js GLTFLoader/AnimationMixer 创建、采样与 `0.3s` 交叉切换测试，每个 clip 包含 195 条 runtime tracks。
- 没有 FBX 因骨骼不兼容而跳过。

Blender 导出器报告两个非阻断告警：部分顶点多于 4 个骨骼权重，glTF 运行时保留权重最高的 4 个；一个材质存在多个图像纹理节点，glTF sampler 使用第一个节点的设置。动画中的 Hips translation 不会被删除，检测结果记录在 manifest，舞台层可自行决定是否抑制 root motion。

## Blender 5.2 API 依据

- [Action / Action Slots](https://docs.blender.org/api/5.2/bpy.types.Action.html)
- [ActionChannelbag F-Curves](https://docs.blender.org/api/5.2/bpy.types.ActionChannelbag.html)
- [FBX import operator](https://docs.blender.org/api/5.2/bpy.ops.import_scene.html)
- [glTF export operator and ACTIONS mode](https://docs.blender.org/api/5.2/bpy.ops.export_scene.html)
