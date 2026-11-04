# 人物和空间修订

## 2026-11-04：人体结构与动作返修 v3（当前版本）

用户否决了 v2 的脸型、发型、肩腿接缝和手指外观。下面的 v2 记录仅作为历史；它的结构测试通过不构成美术验收。

本轮按用户要求，只读拆解旧项目的 Mixamo 人物。演员改用 Ch23；五种观众分别使用 Ch07、Ch31、Ch21、Ch23、Ch02。保留原人体网格、脸部/头发贴图、分离手指、连续肩腿蒙皮与65骨架，重绘衣服的暖陶土/橄榄/奶油材质，统一到1.78米参考身高与本项目方向。**这是旧第三方人体的改编，不是全新原创人体，也不是 v2 球体拼接的继续包装。** 旧归档原件完全不改写。

演员有放松站立、挥手、说话、解释、坐姿、聆听、笑、鼓掌8段动作。说话/解释来自旧 Ch06 动作并重定向到 Ch23 身体；观众保留5段。坐姿按本项目0.525米坐垫重新烘焙骨盆与双腿，脚在地面，笑声动作保留上身表现而以稳定坐姿替代原素材缩在不同椅子下的脚部动作。此动作库只用于预览和观众表现，不替代真实演员的录制。

头手跟随改为独立显示驱动：测量节点准确保留原始位置和朝向；可见手腕依据 WebXR grip 的手掌中心、+Y朝向手臂的约定及本模型75毫米偏移求解。上臂/前臂骨长固定，超出臂长时限制可见手部的可达范围，不能为了贴住测量点把腕部拉脱。头部将观看参考点换算到颅骨轴心。肘部和身体仍是估算，手指为模型的预设姿态；没有凭空生成真人手指、腿或口型数据。

模型映射升级为 `soft-clay-human-grip-v3` / `v3-human-candidate`，避免旧工作副本被默认为经过新人体审核。原始录制可以保留，在素材库重新准备工作副本即可。研究仍为草稿/关闭状态。

场景保留24座与4桌。书架及书本/植物整体移到右墙两盏灯之间；两张新生成的暖色纸质插画以六幅装框画分布到两侧墙，原文字小海报保留在下方，新增检查确保书架、画框与壁灯不相交。

网页截图发现仅移书架仍会从观众视点遮灯，故两侧壁灯统一提升至2.45米，并增加观众位置到右墙灯具的实际网格射线检查；不能用包围盒不相交代替视线无遮挡。

PC入口 `/study/scene-review` 新增手部特写，以及动作来源选择（说话、解释、站立、挥手、三点合成跟随）。所有预设动作都明确标注，不能用它的自然程度冒充真人录制跟随的验收。

### 来源核对（2026-11-04）

- [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)：官方说明人物和动画可免版税用于个人、商业、非营利项目。当前使用的是项目原有副本，作为本系统嵌入资源，不另发独立资产包，也不把它标为CC0。
- [MakeHuman/MPFB许可](https://download.makehumancommunity.org/about/license.html)：核心图形资产为CC0，可作为后续可自由改造的基础人体来源；本轮没有下载或冒充已接入。
- [VRM normalized bones](https://github.com/pixiv/three-vrm/blob/dev/guides/migration-guide-1.0.md)：规范化人形骨骼有利于不同骨轴间映射；本轮直接规范化已有骨架，没有新增VRM依赖。
- [WebXR输入规范](https://immersive-web.github.io/webxr/#xrinputsource-interface)：grip是握持手掌中心，不是手腕；本轮据此分离测量和可见骨架。

### 可编辑源件与复现

`local_assets/models/human-v3/` 保留提取的结构/动作、原始生成海报、`actor-rigged-review.blend` 和 `club-stage-review.blend`。运行时只读取 `public/study/club/v1/` 的新工作副本，不读取归档；全尺寸源件留在本机。

```powershell
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/extract-human-source.py
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/extract-actor-textures.py
node --import tsx scripts/art/export-human-avatars.mjs
node scripts/art/align-club-layout.mjs
node scripts/art/decorate-club.mjs
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/build-human-review.py
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python scripts/art/build-human-stage.py
```

导出需要本机已有来源及生成海报；源件不齐会报错。运行导出前关闭正在读取模型的预览服务，避免Windows文件占用。纹理像素仍需网页截图检查；自动结构检查不代表脸部风格或Quest性能通过。

演员的脸部、睫毛与头发贴图另从本机 `local_assets/mixamo/output/Ch23_nonPBR_avatar.glb` 完整源件提取到1024像素上限，避免放大旧观众256像素副本。其余观众保留小贴图以控制整场负担。坐姿骨盆相对椅子前移12厘米，让腿部离开坐垫前缘；不是修改椅子数量或参与者分配。

两张海报通过内置 imagegen 生成，提示分别为“暖色中世纪纸质插画，麦克风、舞台帘幕与声音曲线，陶土/奶油/鼠尾草绿，无人物文字商标”和“同风格咖啡杯、橄榄叶、拱形与笑声曲线，无人物文字商标”。完整用途是俱乐部墙面纹理，源图 `microphone-poster.png`、`coffee-poster.png`；运行PNG嵌入GLB，未放外部图像请求。

## 历史：Clay v2

2026-11-03，依据用户反馈重新对照 `04-soft-clay-club.png`，使用本机 Blender 5.2.3 LTS 制作。此前的自动结构检查不能证明美术质量，旧分块原型不作为外观验收结论。

## 本次修复

- 原人物使用刚性球体/胶囊拼接；重做连续外套、衣袖、裤腿、手掌和鼻梁/下颌。外套前襟有真实开口，补充领口、贴身口袋、衣扣、鞋底和发型轮廓。六个人物保留不同配色及短发、短波波头、发髻。
- 原默认播放只移动手腕，手臂停在原位。现在运行场景和本项目模型复查均连接手臂，袖口对手腕混合蒙皮；连续扫描完整合成动作确认不脱节。肘部是显示估算，仍没有全身、手指或面部实录。原始头手位置/朝向和声音不改写，研究模式仍关闭。
- 前区侧椅与直径0.92米的桌子发生实体包围盒相交。保留四桌及24座数量，前区侧椅向外移动0.18米、中椅向后移动0.18米，同步运行座位表、GLB与布局清单。原样椅几何不修改。
- 左墙海报与壁灯相交，移至灯之间；话筒架移到舞台右侧1.0米，离开中性手势范围；书本/花盆对齐搁板。
- 素材加载和完整性检查改为重新验证缓存，避免更新模型后旧文件仍被强制复用。
- 增加柔和接触阴影和PC七视角检查页 `/study/scene-review`：正面、面部、侧面、背面、坐姿、全场、俯视；检查页使用实际发布GLB和同一映射实现。

## 可编辑源件和复现

本机 `local_assets/models/clay-avatar-v2/`：

- `clay-avatar-v2.blend`：独立部件、连续曲面与修改器，适合继续改形。
- `actor-rigged-review.blend`：实际导出的演员、51骨骼、六动画、三个表情形变和摄影机/灯光。
- `club-stage-review.blend`：实际家具、演员和23名可见观众，保留骨架和坐姿动画；检查摄影机隐藏近墙与顶棚，正式场景仍完整。

在项目目录执行（Blender安装路径依本机调整）：

```powershell
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --python scripts/art/sculpt-clay-avatars.py
node --import tsx scripts/art/export-clay-avatars.mjs
node scripts/art/align-club-layout.mjs
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --python scripts/art/build-blender-review.py
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --python scripts/art/build-blender-stage.py
```

导出依赖本机保留的 v1 原骨架/场景源件，缺失会报错，不从网络或归档替换。旧总包不覆盖，新的网页副本及哈希在 `public/study/club/v1/` 更新。这里的 `v1-candidate` 保留录制骨架兼容标识，具体美术修订另由GLB元信息、清单哈希和构建提交标识区分。

## 验证边界

自动检查涵盖实际家具碰撞、灯/海报位置、24座一致性、混合权重、完整动作中的袖口/手腕距离、原始姿态不变、缺失保护、资源释放和文件哈希。Blender静态渲染与网页实际截图都单独检查；前者不是网页光照效果的证明。

新的脸型、服装比例仍需用户审美确认；未声称与概念图逐像素一致。Quest中的近距离观感、真实录制的手柄/手腕偏移、极端动作与实际帧率仍须实机确认。当前控制器/手腕录制格式没有手指关节，不能据此还原握拳、指向等细节手势。

坐姿后续复核：骨盆抬高5厘米、前移12厘米，并同步腿部角度以保留脚底高度；坐姿/聆听/笑声的双手重写为轻放腿上，拍手动作保留独立含义。颈部改为混合蒙皮，显示层增加有界侧倾连接头部；二者都不写回录制数据。
