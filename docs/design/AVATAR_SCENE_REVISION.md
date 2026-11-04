# 人物和空间修订：Clay v2

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
